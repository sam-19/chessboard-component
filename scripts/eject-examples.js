import fs from 'fs';
import kidif from 'kidif';
import glob from 'glob';
import path from 'path';

const examples = new Map();

const examplesGroups = [
  {
    name: 'Basic Usage',
    examples: [1000, 1001, 1002, 1003, 1004]
  },
  {
    name: 'Config',
    examples: [2000, 2044, 2063, 2001, 2002, 2003, 2082, 2004, 2030, 2005, 2006]
  },
  {
    name: 'Methods',
    examples: [3000, 3001, 3002, 3003, 3004, 3005, 3007]
  },
  {
    name: 'Events',
    examples: [4000, 4001, 4002, 4003, 4004, 4005, 4006, 4011, 4012]
  },
  {
    name: 'Integration',
    examples: [5000, 5001, 5002, 5003, 5004, 5005]
  }
];

const getGroup = (id) => {
  for (const g of examplesGroups) {
    for (const e of g.examples) {
      if (e == id) {
        return g.name;
      }
    }
  }
};

// grab the examples
const examplesArr = kidif('docs/examples/*.example');
console.assert(examplesArr, 'Could not load the Example files');
console.assert(examplesArr.length > 1, 'Zero examples loaded');

glob('docs/examples/*.example', (e, files) => {
  for (const f of files) {
    const filename = path.basename(f);
    const name = filename.substring(0, filename.length - '.example'.length);
    const id = name.substring(0, 4);
    // console.log(f, id, name);
    examples.set(id, {
      name,
      group: getGroup(id),
    });
  }

  console.log(examplesArr[0]);

  for (const exampleData of examplesArr) {
    const id = exampleData.id;
    // console.log('id', id);
    console.assert(id, 'No id');
    const example = examples.get(id);
    console.assert(example, 'No example');

    const frontmatter = {
      title: exampleData.name,
      description: exampleData.description,
      id: id,
      group: getGroup(id),
    };

    console.log('group', id, getGroup(id));

    const frontmatterList = [];
    for (const [name, value] of Object.entries(frontmatter)) {
      if (value !== undefined) {
        frontmatterList.push(`${name}: ${value}`);
      }
    }
    const frontmatterString = frontmatterList.join('\n');

    fs.writeFileSync(`docs/examples/${example.name}.md`, 
`---
${frontmatterString}
---
`, 'utf-8');

    if (exampleData.html) {
      fs.writeFileSync(`docs/examples/_source/${example.name}.html`, exampleData.html, 'utf-8');
    }

    if (exampleData.js) {
      fs.writeFileSync(`docs/examples/_source/${example.name}.js`, exampleData.js, 'utf-8');
    }

  }
  
});
