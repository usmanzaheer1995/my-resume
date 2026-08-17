const DATA_URL = 'resume.json';
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function link(className, text, href) {
  const a = el('a', className, text);
  a.href = href;
  return a;
}

// Icons live as <symbol> elements in the sprite at the top of resume.html
// resume.json only names the one it wants.
function icon(name) {
  if (!name) return null;
  if (!document.getElementById(`icon-${name}`)) {
    console.warn(`resume.html: no <symbol id="icon-${name}"> in the sprite`);
    return null;
  }
  const svg = document.createElementNS(SVG_NS, 'svg');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.appendChild(use);
  return svg;
}

function dateRange(start, end) {
  return [start, end].filter(Boolean).join(' - ');
}

function titleWithDates(name, start, end) {
  const range = dateRange(start, end);
  return range ? `${name} (${range})` : name;
}

function bulletList(items) {
  const ul = el('ul', 'bullets');
  (items || []).forEach((text) => ul.appendChild(el('li', null, text)));
  return ul;
}

/* --------------- header ---------------- */

function renderContact(rows) {
  const wrap = el('div', 'contact');
  (rows || []).forEach((row) => {
    const line = el('div', 'contact-row');
    line.appendChild(row.href ? link(null, row.text, row.href) : el('span', null, row.text));
    const badge = el('span', 'contact-icon');
    const svg = icon(row.icon);
    if (svg) badge.appendChild(svg);
    line.appendChild(badge);
    wrap.appendChild(line);
  });
  return wrap;
}

function renderHeader(data) {
  const header = el('header', 'header');
  const card = el('div', 'header-card');
  card.append(
    el('h1', 'name', data.header.name),
    el('p', 'role', data.header.role),
    el('p', 'summary', data.header.summary)
  );
  header.append(
    card,
    el('div', 'photo'),
    el('div', 'notch'),
    renderContact(data.contact)
  );
  return header;
}

/* ------------------ sections ------------------- */

/*
  One entry per section key in resume.json. Each returns an array of nodes to
  drop under the section heading. Adding a new kind of section means adding a
  renderer here.
  An unrecognised key is skipped with a warning.
*/
const RENDERERS = {
  workExperience: (section) =>
    (section.jobs || []).map((job) => {
      const block = el('div', 'job');
      block.append(el('p', 'job-title', job.title), el('p', 'job-company', job.company));

      const meta = el('div', 'job-meta');
      meta.append(
        el('span', null, dateRange(job.startDate, job.endDate)),
        el('span', null, job.location || '')
      );
      block.appendChild(meta);

      if (job.bulletsLabel) block.appendChild(el('div', 'job-label', job.bulletsLabel));
      block.appendChild(bulletList(job.bullets));
      return block;
    }),

  education: (section) =>
    (section.entries || []).map((entry) => {
      const block = document.createDocumentFragment();
      block.append(
        el('p', 'edu-degree', entry.degree),
        el('p', 'edu-school', entry.school),
        el('div', 'edu-date', dateRange(entry.startDate, entry.endDate))
      );
      return block;
    }),

  skills: (section) => {
    const wrap = el('div', 'skills');
    (section.items || []).forEach((skill) => wrap.appendChild(el('span', null, skill)));
    return [wrap];
  },

  personalProjects: (section) =>
    (section.projects || []).map((project) => {
      const block = el('div', 'project');
      block.append(
        el('h3', null, titleWithDates(project.name, project.startDate, project.endDate)),
        bulletList(project.bullets)
      );
      return block;
    }),

  certificates: (section) =>
    (section.entries || []).map((cert) => {
      const block = el('div', 'cert');
      block.appendChild(
        el('p', 'cert-name', titleWithDates(cert.name, cert.startDate, cert.endDate))
      );
      if (cert.href) block.appendChild(link('cert-link', cert.linkText || cert.href, cert.href));
      return block;
    }),
};

function sectionHead(section) {
  const head = el('div', 'section-head');
  const badge = el('span', 'badge');
  badge.appendChild(el('span', 'badge-front'));
  const svg = icon(section.icon);
  if (svg) badge.appendChild(svg);
  head.append(badge, el('h2', null, section.heading));
  return head;
}

function renderSection(key, section) {
  const build = RENDERERS[key];
  if (!build) {
    console.warn(`resume.json: no renderer for section "${key}" — skipped`);
    return null;
  }
  const node = el('section', 'section');
  node.appendChild(sectionHead(section));
  build(section).forEach((child) => node.appendChild(child));
  return node;
}

/* --------------- page ---------------- */

function applyMeta(data) {
  const meta = data.meta || {};
  if (meta.lang) document.documentElement.lang = meta.lang;
  document.title = meta.title || (data.header && data.header.name) || 'Resume';

  const photo = data.photo || {};
  const layers = [photo.remoteUrl, photo.local]
    .filter(Boolean)
    .map((url) => `url("${url.replace(/["\\]/g, '\\$&')}")`)
    .join(', ');
  if (layers) document.documentElement.style.setProperty('--photo', layers);
}

function buildFirstPage(data) {
  const page = el('div', 'page');
  page.appendChild(renderHeader(data));

  const grid = el('div', 'body-grid');
  const left = el('div', 'col-left');
  const right = el('div', 'col-right');

  Object.entries(data.sections || {}).forEach(([key, section]) => {
    const node = renderSection(key, section);
    if (node) (section.column === 'left' ? left : right).appendChild(node);
  });

  grid.append(left, right);
  page.appendChild(grid);
  return page;
}

/* paging */

const MAX_PAGES = 20;

// Lowest y a block may reach before it has spilled off the sheet.
function contentBottom(page) {
  const pad = parseFloat(getComputedStyle(page).paddingBottom) || 0;
  return page.getBoundingClientRect().bottom - pad;
}

function overflowsPast(node, limit) {
  return node.getBoundingClientRect().bottom > limit + 0.5;
}

// Detach the first block that crosses `limit`, plus everything after it.
function takeOverflow(blocks, limit) {
  const index = blocks.findIndex((block) => overflowsPast(block, limit));
  if (index < 0) return [];
  const moved = blocks.slice(index);
  moved.forEach((block) => block.remove());
  return moved;
}

function slimHeader(data) {
  const bar = el('div', 'page-header');
  bar.append(el('span', 'page-name', data.header.name), el('span', 'page-num'));
  return bar;
}

function paginate(root, data) {
  const first = root.querySelector('.page');
  const limit = contentBottom(first);
  const spill = [];

  const workSection = first.querySelector('.col-left .section');
  if (workSection) {
    const jobs = Array.from(workSection.children).filter((n) => n.classList.contains('job'));
    const moved = takeOverflow(jobs, limit);
    if (moved.length) {
      const work = data.sections.workExperience || {};
      spill.push({ heading: { heading: `${work.heading} (continued)`, icon: work.icon }, nodes: moved });
    }
  }

  const right = first.querySelector('.col-right');
  if (right) {
    const moved = takeOverflow(Array.from(right.children), limit);
    if (moved.length) spill.push({ heading: null, nodes: moved });
  }

  const pages = [first];
  if (!spill.length) return pages;

  let flow = null;
  let bottom = 0;
  let repeatHeading = null;

  const startPage = () => {
    if (pages.length >= MAX_PAGES) return false;
    const page = el('div', 'page');
    page.appendChild(slimHeader(data));
    flow = el('div', 'col-flow');
    page.appendChild(flow);
    root.appendChild(page);
    pages.push(page);
    bottom = contentBottom(page);
    if (repeatHeading) flow.appendChild(sectionHead(repeatHeading));
    return true;
  };

  startPage();

  spill.forEach((group) => {
    repeatHeading = group.heading;
    if (group.heading) flow.appendChild(sectionHead(group.heading));

    group.nodes.forEach((node) => {
      flow.appendChild(node);
      /* A block that overflows an otherwise-empty flow is taller than a whole
         page — nothing to be gained by moving it, so leave it where it is. */
      if (overflowsPast(node, bottom) && flow.children.length > 1) {
        node.remove();
        if (startPage()) flow.appendChild(node);
      }
    });
  });

  return pages;
}

function numberPages(pages) {
  if (pages.length < 2) return;
  pages.forEach((page, i) => {
    const label = page.querySelector('.page-num');
    if (label) label.textContent = `Page ${i + 1} of ${pages.length}`;
  });
}

function render(data) {
  applyMeta(data);

  const root = document.getElementById('resume');
  root.replaceChildren(buildFirstPage(data));

  /* Webfonts change line heights, so measuring before Lato lands would
     paginate against the fallback metrics and break after it swaps in. */
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  return fontsReady.then(() => numberPages(paginate(root, data)));
}

// Without this the page would just sit blank and the overwhelmingly likely
// cause is opening the file directly, since browsers refuse fetch() on file://.
function showError(err) {
  const box = el('div');
  box.setAttribute(
    'style',
    'max-width:44rem;margin:3rem auto;padding:1.5rem 1.75rem;background:#fff;' +
      'border-left:4px solid #449399;border-radius:6px;font:14px/1.6 system-ui,sans-serif'
  );
  box.appendChild(el('h1', null, 'Could not load resume.json')).style.cssText =
    'margin:0 0 .5rem;font-size:1.1rem;color:#313C4E';

  if (location.protocol === 'file:') {
    box.appendChild(
      el(
        'p',
        null,
        'The page was opened straight from disk. Browsers block fetch() on file:// URLs, ' +
          'so the JSON can never load this way. Serve the folder over HTTP instead:'
      )
    );
    const cmd = el('pre', null, 'python3 -m http.server 8000');
    cmd.setAttribute(
      'style',
      'background:#f4f4f4;padding:.6rem .8rem;border-radius:4px;overflow-x:auto;margin:.5rem 0'
    );
    box.appendChild(cmd);
    box.appendChild(el('p', null, 'then open http://localhost:8000/resume.html'));
  } else {
    box.appendChild(el('p', null, `${err}. Check that resume.json sits next to resume.html and is valid JSON.`));
  }

  document.getElementById('resume').replaceChildren(box);
}

fetch(DATA_URL)
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${DATA_URL}`);
    return res.json();
  })
  .then(render)
  .catch(showError);
