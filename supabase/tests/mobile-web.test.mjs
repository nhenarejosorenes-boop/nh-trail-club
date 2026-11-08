import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');
const file = new URL('../../components/WebAppChrome.tsx', import.meta.url);
const code = transformSync(readFileSync(file, 'utf8'), {
  filename: file.pathname,
  jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' },
  module: { type: 'commonjs' },
}).code;

function chrome(pathname, hooks = React, environment = {}) {
  const module = { exports: {} };
  function local(name) {
    if (name === 'react') return hooks;
    if (name === 'next/navigation') return { usePathname: () => pathname };
    if (name === 'next/link') return { __esModule: true, default: ({ children, onNavigate, ...props }) => React.createElement('a', props, children) };
    if (name.endsWith('.css')) return {};
    return require(name);
  }
  new Function('require', 'module', 'exports', 'window', 'navigator', code)(local, module, module.exports, environment.window, environment.navigator);
  return module.exports.default;
}

for (const [pathname, href] of [
  ['/dashboard', '/dashboard'], ['/entrenamientos/fuerza', '/entrenamientos'],
  ['/entrenamientos/trail', '/entrenamientos'], ['/entrenamientos/plan', '/entrenamientos'],
  ['/objetivos', '/entrenamientos'], ['/dispositivos', '/entrenamientos'],
  ['/importar-actividad', '/entrenamientos'], ['/salidas', '/salidas'],
  ['/mensajes', '/mensajes'], ['/progreso', '/progreso'], ['/seguimiento-trail', '/progreso'],
]) {
  test(`mobile navigation marks only the correct section on ${pathname}`, () => {
    const html = renderToStaticMarkup(React.createElement(chrome(pathname), null, 'Contenido'));
    assert.ok(html.includes('aria-label="Navegación móvil"'));
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, new RegExp(`href="${href}"[^>]*aria-current="page"`));
    assert.ok(html.includes('Contenido'));
  });
}

test('public and account recovery screens have no club navigation', () => {
  for (const pathname of ['/', '/login', '/instalar', '/forgot-password', '/reset-password', '/dashboard-invalid']) {
    const html = renderToStaticMarkup(React.createElement(chrome(pathname), null, 'Contenido'));
    assert.equal(html.includes('Navegación móvil'), false, pathname);
  }
});

function harness(pathname, online = true) {
  const states = [], effects = [], target = new EventTarget();
  let cursor = 0;
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }];
    },
    useEffect(effect) { effects.push(effect); },
  };
  const browserWindow = { dispatchEvent: event => target.dispatchEvent(event), addEventListener: (...args) => target.addEventListener(...args), removeEventListener: (...args) => target.removeEventListener(...args) };
  const Component = chrome(pathname, hooks, { window: browserWindow, navigator: { onLine: online } });
  return { target, states, effects,
    render() { cursor = 0; return Component({ children: 'Contenido' }); },
  };
}

function descendants(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(descendants)];
}

test('navigation honors the editor veto and proceeds when it is cleared', () => {
  const h = harness('/entrenamientos/trail');
  const link = descendants(h.render()).find(node => node.props?.href === '/dashboard');
  let prevented = false;
  const veto = event => event.preventDefault();
  h.target.addEventListener('nh:before-navigation', veto);
  link.props.onNavigate({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  h.target.removeEventListener('nh:before-navigation', veto);
  prevented = false;
  link.props.onNavigate({ preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});

test('connection loss, recovery, dismissal and listener cleanup work together', () => {
  const h = harness('/dashboard');
  h.render();
  const cleanup = h.effects[0]();
  h.target.dispatchEvent(new Event('offline'));
  let html = renderToStaticMarkup(h.render());
  assert.ok(html.includes('Sin conexión.'));
  assert.ok(html.includes('role="status"'));
  h.target.dispatchEvent(new Event('online'));
  html = renderToStaticMarkup(h.render());
  assert.ok(html.includes('Conexión recuperada.'));
  const dismiss = descendants(h.render()).find(node => node.type === 'button');
  dismiss.props.onClick();
  assert.equal(renderToStaticMarkup(h.render()).includes('Conexión recuperada.'), false);
  cleanup();
  h.target.dispatchEvent(new Event('offline'));
  assert.equal(h.states[0], false);
});

test('opening the app offline immediately exposes the connection warning', () => {
  const h = harness('/dashboard', false);
  h.render();
  const cleanup = h.effects[0]();
  assert.ok(renderToStaticMarkup(h.render()).includes('Sin conexión.'));
  h.target.dispatchEvent(new Event('online'));
  assert.ok(renderToStaticMarkup(h.render()).includes('Conexión recuperada.'));
  cleanup();
});
