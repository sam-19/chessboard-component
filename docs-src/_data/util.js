function getPath(path) {
  const parts = path.split('.');
  return (value, i) => {
    let o = value;
    for (const p of parts) {
      if (o == null) {
        return;
      }
      o = o[p];
    }
    return o;
  };
}

function methodName(name) {
  return name && name.replace(/\(.+$/, '');
}

function htmlList(v) {
  if (!Array.isArray(v)) {
    v = [v];
  }
  return v.map((s) => `<p>${s}</p>`).join('\n');
}

function getMainClass(docs) {
  return docs.modules[0].exports[0];
}

function getProperties(docs) {
  return getMainClass(docs).members.filter((m) => m.kind === 'field');
}

function getMethods(docs) {
  return getMainClass(docs).members.filter((m) => m.kind === 'method');
}

function getAttributes(docs) {
  return getMainClass(docs).events;
}

function getEvents(docs) {
  return getMainClass(docs).events;
}

function getCssProperties(docs) {
  return getMainClass(docs).cssProperties;
}

function getCssParts(docs) {
  return getMainClass(docs).cssParts;
}

module.exports = () => ({
  getPath,
  methodName,
  htmlList,
  getMainClass,
  getProperties,
  getMethods,
  getAttributes,
  getEvents,
  getCssProperties,
  getCssParts,
});
