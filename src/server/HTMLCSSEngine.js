'use strict';

/**
 * ThyScript HTMLCSSEngine
 * HTML/CSS generation, templating, minification, SSR, and web component tooling.
 */
class HTMLCSSEngine {
  constructor() {
    // Vendor prefix map: CSS property -> prefixes needed
    this._vendorPrefixMap = {
      'animation': ['-webkit-animation', 'animation'],
      'animation-name': ['-webkit-animation-name', 'animation-name'],
      'animation-duration': ['-webkit-animation-duration', 'animation-duration'],
      'animation-delay': ['-webkit-animation-delay', 'animation-delay'],
      'animation-iteration-count': ['-webkit-animation-iteration-count', 'animation-iteration-count'],
      'animation-timing-function': ['-webkit-animation-timing-function', 'animation-timing-function'],
      'transition': ['-webkit-transition', '-moz-transition', '-o-transition', 'transition'],
      'transform': ['-webkit-transform', '-moz-transform', '-ms-transform', 'transform'],
      'transform-origin': ['-webkit-transform-origin', '-moz-transform-origin', 'transform-origin'],
      'box-shadow': ['-webkit-box-shadow', 'box-shadow'],
      'border-radius': ['-webkit-border-radius', 'border-radius'],
      'user-select': ['-webkit-user-select', '-moz-user-select', '-ms-user-select', 'user-select'],
      'appearance': ['-webkit-appearance', '-moz-appearance', 'appearance'],
      'flex': ['-webkit-flex', 'flex'],
      'flex-direction': ['-webkit-flex-direction', 'flex-direction'],
      'flex-wrap': ['-webkit-flex-wrap', 'flex-wrap'],
      'align-items': ['-webkit-align-items', 'align-items'],
      'justify-content': ['-webkit-justify-content', 'justify-content'],
      'backdrop-filter': ['-webkit-backdrop-filter', 'backdrop-filter'],
      'clip-path': ['-webkit-clip-path', 'clip-path'],
    };

    // ThyScript CSS syntax keywords
    this._thyCSSSyntax = {
      'center': 'display: flex; align-items: center; justify-content: center;',
      'flex-row': 'display: flex; flex-direction: row;',
      'flex-col': 'display: flex; flex-direction: column;',
      'full': 'width: 100%; height: 100%;',
      'full-w': 'width: 100%;',
      'full-h': 'height: 100%;',
      'hidden': 'display: none;',
      'absolute-fill': 'position: absolute; top: 0; left: 0; right: 0; bottom: 0;',
      'fixed-fill': 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999;',
      'ellipsis': 'overflow: hidden; white-space: nowrap; text-overflow: ellipsis;',
      'no-select': 'user-select: none; -webkit-user-select: none;',
      'smooth': 'transition: all 0.3s ease;',
      'shadow': 'box-shadow: 0 2px 8px rgba(0,0,0,0.12);',
      'shadow-lg': 'box-shadow: 0 8px 32px rgba(0,0,0,0.2);',
      'rounded': 'border-radius: 8px;',
      'rounded-full': 'border-radius: 9999px;',
      'card': 'background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px;',
      'glass': 'background: rgba(255,255,255,0.15); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2);',
    };

    // In-memory component registry for reactive rendering
    this._components = new Map();
    this._componentStates = new Map();
  }

  // ─────────────────────────────────────────────
  // Template Rendering
  // ─────────────────────────────────────────────

  /**
   * Renders an HTML template string with Mustache-like {{ var }} interpolation.
   * Supports: {{ var }}, {{ var | default }}, {{# if cond }}...{{/ if }},
   * {{# each items }}...{{/ each }}, {{! comment }}
   * @param {string} htmlString
   * @param {object} context
   * @returns {string}
   */
  render(htmlString, context = {}) {
    if (typeof htmlString !== 'string') throw new Error('htmlString must be a string');

    let result = htmlString;

    // Strip comments: {{! ... }}
    result = result.replace(/\{\{![\s\S]*?\}\}/g, '');

    // Process {{# each items }}...{{/ each }}
    result = result.replace(/\{\{#\s*each\s+(\w[\w.]*)\s*\}\}([\s\S]*?)\{\{\/\s*each\s*\}\}/g, (_, key, template) => {
      const items = this._resolve(context, key);
      if (!Array.isArray(items)) return '';
      return items.map((item, index) => {
        const itemCtx = typeof item === 'object' ? { ...context, ...item, $index: index, $first: index === 0, $last: index === items.length - 1 } : { ...context, this: item, $index: index };
        return this.render(template, itemCtx);
      }).join('');
    });

    // Process {{# if condition }}...{{/ if }} (with optional {{else}})
    result = result.replace(/\{\{#\s*if\s+([\w.!]+)\s*\}\}([\s\S]*?)\{\{\/\s*if\s*\}\}/g, (_, cond, content) => {
      const negated = cond.startsWith('!');
      const key = negated ? cond.slice(1) : cond;
      let val = this._resolve(context, key);
      if (negated) val = !val;
      const [trueBlock, falseBlock = ''] = content.split(/\{\{else\}\}/);
      return val ? trueBlock : falseBlock;
    });

    // Process {{ var | defaultValue }} and {{ var }}
    result = result.replace(/\{\{\s*([\w.$]+)\s*(?:\|\s*(.*?))?\s*\}\}/g, (_, key, defaultVal) => {
      const val = this._resolve(context, key);
      if (val === undefined || val === null) return defaultVal !== undefined ? defaultVal.trim() : '';
      return this._escapeHTML(String(val));
    });

    return result;
  }

  _resolve(context, keyPath) {
    const parts = keyPath.split('.');
    let val = context;
    for (const part of parts) {
      if (val === undefined || val === null) return undefined;
      val = val[part];
    }
    return val;
  }

  _escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // ─────────────────────────────────────────────
  // Full Page Generation
  // ─────────────────────────────────────────────

  /**
   * Generates a complete HTML page from a ThyScript config object.
   * @param {object} config
   * @param {string} [config.title]
   * @param {string} [config.description]
   * @param {string} [config.charset]
   * @param {string} [config.lang]
   * @param {string[]} [config.cssLinks] - External CSS URLs
   * @param {string[]} [config.scriptSrcs] - External script URLs
   * @param {object} [config.meta] - Extra meta tags { name: content }
   * @param {object} [config.ogMeta] - OpenGraph meta { property: content }
   * @param {string} [config.inlineCSS]
   * @param {string} [config.inlineScript]
   * @param {string} [config.body]
   * @param {string} [config.favicon]
   * @param {string} [config.theme] - 'light' | 'dark' | 'auto'
   * @param {boolean} [config.responsive]
   * @returns {string}
   */
  generatePage(config = {}) {
    const {
      title = 'ThyScript App',
      description = '',
      charset = 'UTF-8',
      lang = 'en',
      cssLinks = [],
      scriptSrcs = [],
      meta = {},
      ogMeta = {},
      inlineCSS = '',
      inlineScript = '',
      body = '',
      favicon = '',
      theme = 'auto',
      responsive = true,
    } = config;

    const metaTags = Object.entries(meta)
      .map(([name, content]) => `  <meta name="${name}" content="${this._escapeHTML(content)}">`)
      .join('\n');

    const ogTags = Object.entries(ogMeta)
      .map(([prop, content]) => `  <meta property="${prop}" content="${this._escapeHTML(content)}">`)
      .join('\n');

    const cssLinkTags = cssLinks.map((href) => `  <link rel="stylesheet" href="${href}">`).join('\n');
    const scriptTags = scriptSrcs.map((src) => `  <script src="${src}" defer></script>`).join('\n');
    const faviconTag = favicon ? `  <link rel="icon" href="${favicon}">` : '';
    const responsiveTag = responsive ? `  <meta name="viewport" content="width=device-width, initial-scale=1.0">` : '';

    const themeCSS = this._generateThemeCSS(theme);

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="${charset}">
${responsiveTag}
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${this._escapeHTML(title)}</title>
  <meta name="description" content="${this._escapeHTML(description)}">
${metaTags}
${ogTags}
${faviconTag}
${cssLinkTags}
${scriptTags}
  <style>
${themeCSS}
${inlineCSS}
  </style>
</head>
<body>
${body}
${inlineScript ? `<script>\n${inlineScript}\n</script>` : ''}
</body>
</html>`;
  }

  // ─────────────────────────────────────────────
  // CSS Generation
  // ─────────────────────────────────────────────

  /**
   * Generates CSS from a JS object (CSS-in-JS).
   * Supports nested selectors, media queries, keyframes, pseudo-classes.
   * @param {object} styles - { selector: { property: value } | nested object }
   * @param {string} [indent='']
   * @returns {string}
   */
  generateCSS(styles, indent = '') {
    if (typeof styles !== 'object' || !styles) return '';
    const parts = [];

    for (const [selector, rules] of Object.entries(styles)) {
      if (typeof rules !== 'object') continue;

      // Check if rules contain nested objects (nested selectors) or are all primitives
      const primitiveRules = {};
      const nestedRules = {};

      for (const [key, val] of Object.entries(rules)) {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          nestedRules[key] = val;
        } else {
          primitiveRules[key] = val;
        }
      }

      // Emit the current selector's properties
      if (Object.keys(primitiveRules).length > 0) {
        const props = this._renderCSSProperties(primitiveRules, indent + '  ');
        parts.push(`${indent}${selector} {\n${props}\n${indent}}`);
      }

      // Emit nested rules
      for (const [nestedSel, nestedRules2] of Object.entries(nestedRules)) {
        // @media / @keyframes etc.
        if (nestedSel.startsWith('@')) {
          const inner = this.generateCSS({ [selector]: nestedRules2 }, indent + '  ');
          parts.push(`${indent}${nestedSel} {\n${inner}\n${indent}}`);
        } else {
          // Nested selector: combine with parent
          const combined = nestedSel.includes('&')
            ? nestedSel.replace(/&/g, selector)
            : `${selector} ${nestedSel}`;
          const inner = this.generateCSS({ [combined]: nestedRules2 }, indent);
          parts.push(inner);
        }
      }
    }

    return parts.join('\n');
  }

  _renderCSSProperties(props, indent) {
    return Object.entries(props)
      .map(([k, v]) => {
        const cssKey = k.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
        const cssVal = Array.isArray(v) ? v.join(', ') : v;
        return `${indent}${cssKey}: ${cssVal};`;
      })
      .join('\n');
  }

  // ─────────────────────────────────────────────
  // Web Component Generator
  // ─────────────────────────────────────────────

  /**
   * Generates a Custom Element (Web Component) definition.
   * @param {string} name - Tag name (must contain a hyphen).
   * @param {string} template - HTML template string.
   * @param {object} styles - CSS-in-JS styles object.
   * @param {string} [script=''] - Additional JS for the component class body.
   * @returns {string} JS string defining the web component.
   */
  generateComponent(name, template, styles, script = '') {
    if (!name.includes('-')) throw new Error('Web component name must contain a hyphen');
    const css = this.generateCSS(styles);
    const escapedTemplate = template.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const escapedCSS = css.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    return `// ThyScript Web Component: <${name}>
(function() {
  'use strict';

  const template = document.createElement('template');
  template.innerHTML = \`
    <style>
      :host {
        display: block;
        box-sizing: border-box;
      }
${escapedCSS}
    </style>
    ${escapedTemplate}
  \`;

  class ${this._toPascalCase(name)} extends HTMLElement {
    static get observedAttributes() {
      return Array.from(this._observedAttrs || []);
    }

    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: 'open' });
      this._shadow.appendChild(template.content.cloneNode(true));
      this._state = {};
      this._init();
    }

    _init() {
      ${script}
    }

    connectedCallback() {
      if (typeof this.onMount === 'function') this.onMount();
    }

    disconnectedCallback() {
      if (typeof this.onDestroy === 'function') this.onDestroy();
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (typeof this.onAttributeChange === 'function') {
        this.onAttributeChange(name, oldVal, newVal);
      }
    }

    setState(newState) {
      this._state = Object.assign({}, this._state, newState);
      if (typeof this.render === 'function') this.render();
    }

    getState() { return { ...this._state }; }

    $(selector) { return this._shadow.querySelector(selector); }
    $$(selector) { return this._shadow.querySelectorAll(selector); }
  }

  customElements.define('${name}', ${this._toPascalCase(name)});
})();
`;
  }

  _toPascalCase(str) {
    return str.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  }

  // ─────────────────────────────────────────────
  // Minification
  // ─────────────────────────────────────────────

  /**
   * Minifies an HTML string.
   * @param {string} html
   * @returns {string}
   */
  minifyHTML(html) {
    if (typeof html !== 'string') return html;
    return html
      // Remove HTML comments (not conditional comments)
      .replace(/<!--(?![\s\S]*?\[if)[\s\S]*?-->/g, '')
      // Collapse whitespace between tags
      .replace(/>\s+</g, '><')
      // Trim whitespace inside tags
      .replace(/\s{2,}/g, ' ')
      // Remove whitespace around block-level tags
      .replace(/\s*(<\/?(html|head|body|div|section|article|header|footer|nav|main|aside|ul|ol|li|table|thead|tbody|tr|th|td|form|fieldset|p|h[1-6]|blockquote|pre)[^>]*>)\s*/gi, '$1')
      .trim();
  }

  /**
   * Minifies a CSS string.
   * @param {string} css
   * @returns {string}
   */
  minifyCSS(css) {
    if (typeof css !== 'string') return css;
    return css
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove whitespace
      .replace(/\s+/g, ' ')
      // Remove spaces around special chars
      .replace(/\s*([:;,{}])\s*/g, '$1')
      // Remove trailing semicolons before }
      .replace(/;}/g, '}')
      // Remove empty rules
      .replace(/[^{}]+\{\}/g, '')
      .trim();
  }

  // ─────────────────────────────────────────────
  // Vendor Autoprefixing
  // ─────────────────────────────────────────────

  /**
   * Adds vendor prefixes to CSS.
   * @param {string} css
   * @returns {string}
   */
  autoPrefix(css) {
    if (typeof css !== 'string') return css;
    let result = css;

    for (const [property, prefixed] of Object.entries(this._vendorPrefixMap)) {
      // Match lines: "  property: value;"
      const regex = new RegExp(`(^|[{;])\\s*(${property.replace(/-/g, '\\-')})\\s*:\\s*([^;}{]+);`, 'gm');
      result = result.replace(regex, (match, before, prop, value) => {
        const declarations = prefixed
          .map((p) => `${p}: ${value};`)
          .join('\n  ');
        return `${before}\n  ${declarations}`;
      });
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // ThyScript CSS Compiler
  // ─────────────────────────────────────────────

  /**
   * Compiles ThyScript-flavored CSS syntax to standard CSS.
   * Supports: keyword shortcuts, variables ($var: value), nesting (&),
   * math expressions (calc expressions), and color functions.
   * @param {string} thyCSS
   * @returns {string}
   */
  compileCSS(thyCSS) {
    if (typeof thyCSS !== 'string') return thyCSS;

    // Extract and apply variables: $varName: value;
    const vars = {};
    let css = thyCSS.replace(/\$(\w+)\s*:\s*([^;]+);/g, (_, name, value) => {
      vars[name] = value.trim();
      return '';
    });

    // Replace variable usages: $varName
    css = css.replace(/\$(\w+)/g, (_, name) => vars[name] || `var(--${name})`);

    // Replace ThyScript keyword shortcuts inside rules
    for (const [keyword, expansion] of Object.entries(this._thyCSSSyntax)) {
      const regex = new RegExp(`\\b${keyword}\\b\\s*;`, 'g');
      css = css.replace(regex, expansion);
    }

    // Expand nested selectors (simple single-level nesting with &)
    css = this._expandNestedCSS(css);

    return css.trim();
  }

  _expandNestedCSS(css) {
    const output = [];
    let i = 0;
    const len = css.length;

    while (i < len) {
      // Find the next selector + block
      const braceOpen = css.indexOf('{', i);
      if (braceOpen === -1) { output.push(css.slice(i)); break; }

      const selector = css.slice(i, braceOpen).trim();
      let depth = 1;
      let j = braceOpen + 1;
      while (j < len && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      const blockContent = css.slice(braceOpen + 1, j - 1);

      // Check for nested selectors inside blockContent
      const nested = [];
      let plainProps = '';
      let k = 0;
      const bl = blockContent.length;
      while (k < bl) {
        const innerBrace = blockContent.indexOf('{', k);
        if (innerBrace === -1) { plainProps += blockContent.slice(k); break; }
        const nestedSelector = blockContent.slice(k, innerBrace).trim();
        // If nestedSelector contains & or looks like a selector, treat as nested
        if (nestedSelector && (nestedSelector.includes('&') || /^[.:#@>~+\[a-zA-Z*]/.test(nestedSelector.replace(/^\s+/, '')))) {
          plainProps += blockContent.slice(k, blockContent.lastIndexOf(nestedSelector, innerBrace)).trim();
          let nd = 1;
          let l = innerBrace + 1;
          while (l < bl && nd > 0) {
            if (blockContent[l] === '{') nd++;
            else if (blockContent[l] === '}') nd--;
            l++;
          }
          const nestedBlock = blockContent.slice(innerBrace + 1, l - 1);
          const resolvedSel = nestedSelector.includes('&')
            ? nestedSelector.replace(/&/g, selector)
            : `${selector} ${nestedSelector}`;
          nested.push(`${resolvedSel} {\n${nestedBlock}\n}`);
          k = l;
        } else {
          plainProps += blockContent.slice(k, innerBrace + 1);
          k = innerBrace + 1;
        }
      }

      if (plainProps.trim()) output.push(`${selector} {\n${plainProps.trim()}\n}`);
      output.push(...nested);
      i = j;
    }

    return output.join('\n');
  }

  // ─────────────────────────────────────────────
  // Complete Responsive Web Page Generator
  // ─────────────────────────────────────────────

  /**
   * Generates a complete responsive web page with all bells and whistles.
   * @param {object} options
   * @param {string} [options.title]
   * @param {string} [options.primaryColor]
   * @param {string} [options.fontFamily]
   * @param {string} [options.theme] - 'light' | 'dark' | 'auto'
   * @param {string} [options.heroTitle]
   * @param {string} [options.heroSubtitle]
   * @param {object[]} [options.sections] - [{ id, title, content }]
   * @param {object[]} [options.navLinks] - [{ href, label }]
   * @param {string} [options.footer]
   * @param {boolean} [options.animations]
   * @returns {string}
   */
  generateWebPage(options = {}) {
    const {
      title = 'ThyScript App',
      primaryColor = '#6366f1',
      fontFamily = "'Segoe UI', system-ui, -apple-system, sans-serif",
      theme = 'auto',
      heroTitle = 'Welcome',
      heroSubtitle = 'Built with ThyScript',
      sections = [],
      navLinks = [],
      footer = `© ${new Date().getFullYear()} ThyScript`,
      animations = true,
    } = options;

    const navHTML = navLinks.length
      ? `<nav class="ts-nav">
          <div class="ts-nav-brand">${this._escapeHTML(title)}</div>
          <ul class="ts-nav-links">
            ${navLinks.map((l) => `<li><a href="${l.href}">${this._escapeHTML(l.label)}</a></li>`).join('')}
          </ul>
        </nav>`
      : '';

    const sectionsHTML = sections.map((s) => `
      <section id="${s.id || ''}" class="ts-section">
        <h2>${this._escapeHTML(s.title || '')}</h2>
        <div class="ts-section-content">${s.content || ''}</div>
      </section>`).join('');

    const animCSS = animations ? this._generateAllAnimations() : '';
    const gridCSS = this._generateGrid(12);
    const themeCSS = this._generateThemeCSS(theme);

    const inlineCSS = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: ${fontFamily}; line-height: 1.6; }
      .ts-nav { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; background: ${primaryColor}; color: #fff; position: sticky; top: 0; z-index: 100; }
      .ts-nav-brand { font-size: 1.25rem; font-weight: 700; }
      .ts-nav-links { list-style: none; display: flex; gap: 1.5rem; }
      .ts-nav-links a { color: #fff; text-decoration: none; opacity: 0.85; transition: opacity 0.2s; }
      .ts-nav-links a:hover { opacity: 1; }
      .ts-hero { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4rem 2rem; background: linear-gradient(135deg, ${primaryColor}22, ${primaryColor}44); }
      .ts-hero h1 { font-size: clamp(2rem, 5vw, 4rem); margin-bottom: 1rem; color: ${primaryColor}; ${animations ? 'animation: ts-fade-in 0.8s ease;' : ''} }
      .ts-hero p { font-size: 1.2rem; opacity: 0.75; max-width: 600px; ${animations ? 'animation: ts-slide-up 0.8s ease 0.2s both;' : ''} }
      .ts-section { padding: 4rem 2rem; max-width: 1200px; margin: 0 auto; }
      .ts-section h2 { font-size: 2rem; margin-bottom: 1.5rem; color: ${primaryColor}; }
      .ts-section-content { opacity: 0.8; }
      .ts-footer { padding: 2rem; text-align: center; background: #f8f8f8; border-top: 1px solid #eee; opacity: 0.7; margin-top: 4rem; }
      @media (max-width: 768px) {
        .ts-nav { flex-direction: column; gap: 0.75rem; }
        .ts-nav-links { flex-wrap: wrap; justify-content: center; }
      }
      ${animCSS}
      ${gridCSS}
      ${themeCSS}
    `;

    const body = `
      ${navHTML}
      <main>
        <div class="ts-hero">
          <h1>${this._escapeHTML(heroTitle)}</h1>
          <p>${this._escapeHTML(heroSubtitle)}</p>
        </div>
        ${sectionsHTML}
      </main>
      <footer class="ts-footer">${footer}</footer>
    `;

    return this.generatePage({ title, inlineCSS, body, responsive: true });
  }

  // ─────────────────────────────────────────────
  // Reactive Rendering
  // ─────────────────────────────────────────────

  /**
   * Renders a component with reactive state.
   * On state changes, re-renders and returns new HTML.
   * @param {{ name: string, template: string, onUpdate?: function }} component
   * @param {object} state
   * @returns {{ html: string, update: function }}
   */
  renderReactive(component, state) {
    const { name, template, onUpdate } = component;
    this._components.set(name, component);
    this._componentStates.set(name, { ...state });

    const render = (currentState) => {
      return this.render(template, currentState);
    };

    const html = render(state);

    const update = (newState) => {
      const currentState = this._componentStates.get(name) || {};
      const merged = { ...currentState, ...newState };
      this._componentStates.set(name, merged);
      const newHtml = render(merged);
      if (typeof onUpdate === 'function') onUpdate(newHtml, merged);
      return newHtml;
    };

    return { html, update, getState: () => ({ ...this._componentStates.get(name) }) };
  }

  // ─────────────────────────────────────────────
  // Server-Side Rendering
  // ─────────────────────────────────────────────

  /**
   * Server-side renders a component with given props.
   * @param {{ template: string, css?: object, wrapper?: string }} component
   * @param {object} props
   * @returns {{ html: string, css: string, fullPage: string }}
   */
  serverSideRender(component, props = {}) {
    const { template, css = {}, wrapper = 'div', name = 'ssr-component' } = component;

    const html = this.render(template, props);
    const cssStr = css ? this.generateCSS(css) : '';
    const prefixedCSS = cssStr ? this.autoPrefix(cssStr) : '';
    const wrappedHTML = `<${wrapper} class="ts-ssr-root" data-component="${name}">${html}</${wrapper}>`;

    const fullPage = this.generatePage({
      title: props.title || name,
      inlineCSS: prefixedCSS,
      body: wrappedHTML,
      meta: { 'generator': 'ThyScript SSR' },
    });

    return { html: wrappedHTML, css: prefixedCSS, fullPage };
  }

  // ─────────────────────────────────────────────
  // Animation Generator
  // ─────────────────────────────────────────────

  /**
   * Generates CSS for a specific animation.
   * @param {'fade'|'slide'|'bounce'|'pulse'|'rotate'|'shake'|'flip'|'zoom'} type
   * @param {object} [opts] - { duration, easing, delay, iterationCount }
   * @returns {string} CSS @keyframes + class definition.
   */
  generateAnimation(type, opts = {}) {
    const {
      duration = '0.5s',
      easing = 'ease',
      delay = '0s',
      iterationCount = '1',
    } = opts;

    const animations = {
      fade: `
@keyframes ts-fade-in { from { opacity: 0; } to { opacity: 1; } }
.ts-fade-in { animation: ts-fade-in ${duration} ${easing} ${delay} ${iterationCount} both; }
@keyframes ts-fade-out { from { opacity: 1; } to { opacity: 0; } }
.ts-fade-out { animation: ts-fade-out ${duration} ${easing} ${delay} ${iterationCount} both; }`,

      slide: `
@keyframes ts-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.ts-slide-up { animation: ts-slide-up ${duration} ${easing} ${delay} ${iterationCount} both; }
@keyframes ts-slide-down { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.ts-slide-down { animation: ts-slide-down ${duration} ${easing} ${delay} ${iterationCount} both; }
@keyframes ts-slide-left { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.ts-slide-left { animation: ts-slide-left ${duration} ${easing} ${delay} ${iterationCount} both; }
@keyframes ts-slide-right { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.ts-slide-right { animation: ts-slide-right ${duration} ${easing} ${delay} ${iterationCount} both; }`,

      bounce: `
@keyframes ts-bounce { 0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0,0,0.2,1); } }
.ts-bounce { animation: ts-bounce ${duration} ${easing} ${delay} ${iterationCount}; }`,

      pulse: `
@keyframes ts-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.ts-pulse { animation: ts-pulse ${duration} ${easing} ${delay} ${iterationCount}; }
@keyframes ts-pulse-scale { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
.ts-pulse-scale { animation: ts-pulse-scale ${duration} ${easing} ${delay} ${iterationCount}; }`,

      rotate: `
@keyframes ts-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.ts-rotate { animation: ts-rotate ${duration} linear ${delay} ${iterationCount}; }
@keyframes ts-rotate-back { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
.ts-rotate-back { animation: ts-rotate-back ${duration} linear ${delay} ${iterationCount}; }`,

      shake: `
@keyframes ts-shake { 0%, 100% { transform: translateX(0); } 10%, 50%, 90% { transform: translateX(-8px); } 30%, 70% { transform: translateX(8px); } }
.ts-shake { animation: ts-shake ${duration} ${easing} ${delay} ${iterationCount}; }`,

      flip: `
@keyframes ts-flip { from { transform: perspective(400px) rotateY(0); } to { transform: perspective(400px) rotateY(180deg); } }
.ts-flip { animation: ts-flip ${duration} ${easing} ${delay} ${iterationCount}; }`,

      zoom: `
@keyframes ts-zoom-in { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.ts-zoom-in { animation: ts-zoom-in ${duration} ${easing} ${delay} ${iterationCount} both; }
@keyframes ts-zoom-out { from { transform: scale(1); opacity: 1; } to { transform: scale(0.8); opacity: 0; } }
.ts-zoom-out { animation: ts-zoom-out ${duration} ${easing} ${delay} ${iterationCount} both; }`,
    };

    return animations[type] || '';
  }

  _generateAllAnimations() {
    return ['fade', 'slide', 'bounce', 'pulse', 'rotate', 'shake', 'flip', 'zoom']
      .map((t) => this.generateAnimation(t))
      .join('\n');
  }

  // ─────────────────────────────────────────────
  // Grid Generator
  // ─────────────────────────────────────────────

  /**
   * Generates a responsive CSS Grid system.
   * @param {number} [columns=12] - Number of grid columns.
   * @param {string} [gap='1rem'] - Grid gap.
   * @param {object} [breakpoints] - { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' }
   * @returns {string}
   */
  generateGrid(columns = 12, gap = '1rem', breakpoints = {}) {
    return this._generateGrid(columns, gap, breakpoints);
  }

  _generateGrid(columns = 12, gap = '1rem', breakpoints = {}) {
    const bp = Object.assign({ sm: '640px', md: '768px', lg: '1024px', xl: '1280px' }, breakpoints);
    const colClasses = [];

    for (let i = 1; i <= columns; i++) {
      colClasses.push(`.ts-col-${i} { grid-column: span ${i} / span ${i}; }`);
    }

    const smCols = Array.from({ length: columns }, (_, i) => `.ts-col-sm-${i + 1} { grid-column: span ${i + 1} / span ${i + 1}; }`);
    const mdCols = Array.from({ length: columns }, (_, i) => `.ts-col-md-${i + 1} { grid-column: span ${i + 1} / span ${i + 1}; }`);
    const lgCols = Array.from({ length: columns }, (_, i) => `.ts-col-lg-${i + 1} { grid-column: span ${i + 1} / span ${i + 1}; }`);

    return `
.ts-grid { display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); gap: ${gap}; }
.ts-grid-auto { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: ${gap}; }
${colClasses.join('\n')}
@media (min-width: ${bp.sm}) { ${smCols.join(' ')} }
@media (min-width: ${bp.md}) { ${mdCols.join(' ')} }
@media (min-width: ${bp.lg}) { ${lgCols.join(' ')} }
`;
  }

  // ─────────────────────────────────────────────
  // Theme Generator
  // ─────────────────────────────────────────────

  /**
   * Generates dark/light mode CSS custom properties.
   * @param {'light'|'dark'|'auto'} [mode='auto']
   * @param {object} [customVars] - Additional CSS variable overrides.
   * @returns {string}
   */
  generateTheme(mode = 'auto', customVars = {}) {
    return this._generateThemeCSS(mode, customVars);
  }

  _generateThemeCSS(mode = 'auto', customVars = {}) {
    const lightVars = Object.assign({
      '--ts-bg': '#ffffff',
      '--ts-bg-secondary': '#f8f9fa',
      '--ts-text': '#1a1a2e',
      '--ts-text-secondary': '#6c757d',
      '--ts-border': '#dee2e6',
      '--ts-primary': '#6366f1',
      '--ts-primary-hover': '#4f46e5',
      '--ts-success': '#10b981',
      '--ts-warning': '#f59e0b',
      '--ts-error': '#ef4444',
      '--ts-info': '#3b82f6',
      '--ts-shadow': 'rgba(0,0,0,0.1)',
      '--ts-card-bg': '#ffffff',
    }, customVars.light || {});

    const darkVars = Object.assign({
      '--ts-bg': '#0f0f23',
      '--ts-bg-secondary': '#1a1a2e',
      '--ts-text': '#e2e8f0',
      '--ts-text-secondary': '#94a3b8',
      '--ts-border': '#2d2d44',
      '--ts-primary': '#818cf8',
      '--ts-primary-hover': '#6366f1',
      '--ts-success': '#34d399',
      '--ts-warning': '#fbbf24',
      '--ts-error': '#f87171',
      '--ts-info': '#60a5fa',
      '--ts-shadow': 'rgba(0,0,0,0.4)',
      '--ts-card-bg': '#1e1e3a',
    }, customVars.dark || {});

    const renderVars = (vars) => Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n');

    if (mode === 'light') {
      return `:root {\n${renderVars(lightVars)}\n}`;
    }
    if (mode === 'dark') {
      return `:root {\n${renderVars(darkVars)}\n}`;
    }
    // Auto (system preference)
    return `
:root {
${renderVars(lightVars)}
}
@media (prefers-color-scheme: dark) {
  :root {
${renderVars(darkVars)}
  }
}
body {
  background-color: var(--ts-bg);
  color: var(--ts-text);
  transition: background-color 0.3s ease, color 0.3s ease;
}
`;
  }
}

module.exports = HTMLCSSEngine;
