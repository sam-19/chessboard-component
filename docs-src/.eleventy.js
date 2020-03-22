const path = require('path');
const fs = require('fs');
const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');
const markdownIt = require('markdown-it');
// const markdownItAnchor = require('markdown-it-anchor');
// const pluginTOC = require('eleventy-plugin-nesting-toc');
// const slugifyLib = require('slugify');

const loadLanguages = require('prismjs/components/');
loadLanguages(['js-templates']);

// Use the same slugify as 11ty here, which is similar at least to Jekyll
// const slugify = (s) => slugifyLib(s, {lower: true});

module.exports = function(eleventyConfig) {
  // eleventyConfig.addPlugin(pluginTOC, {tags: ['h2']});
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPassthroughCopy('js/*');
  eleventyConfig.addPassthroughCopy('css/*');
  eleventyConfig.addPassthroughCopy('img/**/*');
  eleventyConfig.addPassthroughCopy('chesspieces/**/*');
  // eleventyConfig.addPassthroughCopy('api/assets/**/*');

  const md = markdownIt({html: true, breaks: true, linkify: true});
                //  .use(markdownItAnchor, {slugify, permalink: false});
  eleventyConfig.setLibrary('md', md);

  eleventyConfig.addCollection('examples', function(collection) {
    return collection.getFilteredByGlob('examples/*').sort(function(a, b) {
      if (a.fileSlug < b.fileSlug) {
        return -1;
      }
      if (b.fileSlug < a.fileSlug) {
        return 1;
      }
      return 0;
    });
  });

  eleventyConfig.addFilter("htmlPath", function(inputPath) {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath);
    const name = basename.substring(0, basename.length - '.md'.length);
    const htmlPath = path.join(dir, '_source', name + '.html');
    return htmlPath;
  });

  eleventyConfig.addFilter("jsPath", function(inputPath) {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath);
    const name = basename.substring(0, basename.length - '.md'.length);
    const htmlPath = path.join(dir, '_source', name + '.js');
    return htmlPath;
  });

  
  eleventyConfig.addFilter("fileExists", function(p) {
    return fs.existsSync(p);
  });

  eleventyConfig.addFilter("markdown", function(s) {
    return typeof s === 'string' ? md.render(s) : s;
  });

  return {
    dir: {
      input: '.',
      output: '../docs',
    },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
};
