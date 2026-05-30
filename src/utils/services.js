const fs = require('fs');
const path = require('path');

let servicesCache = null;

function loadServices() {
  if (servicesCache) return servicesCache;

  const filePath = path.join(__dirname, '../../services.txt');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  const services = [];
  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.+?)\s+➤\s+\/find_(.+)$/);
    if (match) {
      const displayName = match[1].trim();
      const code = match[2].trim();
      services.push({ name: displayName, code });
    }
  }

  servicesCache = services;
  return services;
}

function searchServices(query) {
  const all = loadServices();
  if (!query) return all;
  const q = query.toUpperCase().trim();
  return all.filter(s => s.name.toUpperCase().includes(q) || s.code.toUpperCase().includes(q));
}

function getServiceByCode(code) {
  const all = loadServices();
  return all.find(s => s.code.toUpperCase() === code.toUpperCase()) || null;
}

function getServicePage(page = 0, pageSize = 8, query = '') {
  const filtered = searchServices(query);
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const items = filtered.slice(page * pageSize, (page + 1) * pageSize);
  return { items, total, totalPages, page };
}

function getTotalServicesCount() {
  return loadServices().length;
}

module.exports = { loadServices, searchServices, getServiceByCode, getServicePage, getTotalServicesCount };
