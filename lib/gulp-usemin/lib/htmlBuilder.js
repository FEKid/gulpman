module.exports = function(file, blocks, options, push, callback) {
  var path = require('path');
  var gutil = require('gulp-util');
  var pipeline = require('./pipeline.js');

  var basePath = file.base;
  var name = path.basename(file.path);
  var mainPath = path.dirname(file.path);

  function createFile(name, content) {
    var filePath = path.join(path.relative(basePath, mainPath), name);
    return new gutil.File({
      path: filePath,
      contents: new Buffer(content)
    })
  }

  function createHTMLAttributes(attributes, index){
    if(!attributes){
      return '';
    }
    var attrArray = [];
    Object.keys(attributes).forEach(function (attribute) {

      var attributeValue = attributes[attribute];

      if (attributeValue === true) {
        attrArray.push(attribute);
        return;
      }
      if (attributeValue === false) {
        return;
      }

      if (Array.isArray(attributeValue)) {
        attrArray.push(attribute + '="' + attributeValue[index] + '"');
      } else {
        attrArray.push(attribute + '="' + attributeValue + '"');
      }

    });
    return ' ' + attrArray.join(' ');
  }

  // fix for revReplace url, if not fix then get: /http://s.cdn.com/public/a/b.js
  function _fixUrlForRevReplace(str){
    return str;
    // return str ? str.replace(/^\//g, '') : str;
  }

  function _fixFilePath(name, file){
    var realRelativeFilePath = '/' + path.relative(options['url_prefix'], name);
    
    file.path = file.path.replace(name, realRelativeFilePath);
    return file;
  }

  var html = [];
  var jsCounter = 0;
  var cssCounter = 0;
  var promises = blocks.map(function(block, i) {
    return new Promise(function(resolve) {
      html[i] = '';
      if (typeof block == 'string') {
        html[i] = block;
        resolve();
      }
      else if (block.files.length == 0){
        resolve();
      }
      else if (block.type == 'js') {
        pipeline(block.name, block.files, block.tasks, function(name, file) {
          _fixFilePath(name, file);
          push(file);

          var jsAttributes = options ? options.jsAttributes : null;
          if (path.extname(file.path) == '.js')
            html[i] += '<script src="' + _fixUrlForRevReplace(name.replace(path.basename(name), path.basename(file.path))) +  '"' + createHTMLAttributes(jsAttributes, jsCounter++) +'></script>';
          resolve();
        }.bind(this, block.nameInHTML));
      }
      else if (block.type == 'css') {
        pipeline(block.name, block.files, block.tasks, function(name, file) {
          _fixFilePath(name, file);
          push(file);
          var cssAttributes = options ? options.cssAttributes : null;
          html[i] += '<link rel="stylesheet" href="' + _fixUrlForRevReplace(name.replace(path.basename(name), path.basename(file.path))) + '"'
            + (block.mediaQuery ? ' media="' + block.mediaQuery + '"' : '') + createHTMLAttributes(cssAttributes, cssCounter++) +'/>';
          resolve();
        }.bind(this, block.nameInHTML));
      }
      else if (block.type == 'inlinejs') {
        pipeline(block.name, block.files, block.tasks, function(file) {
          html[i] = '<script>' + String(file.contents) + '</script>';
          resolve();
        }.bind(this));
      }
      else if (block.type == 'inlinecss') {
        pipeline(block.name, block.files, block.tasks, function(file) {
          html[i] = '<style' + (block.mediaQuery ? ' media="' + block.mediaQuery + '"' : '') + '>'
            + String(file.contents) + '</style>';
          resolve();
        }.bind(this));
      }
      else if (block.type == 'htmlimport') {
        pipeline(block.name, block.files, block.tasks, function(name, file) {
          _fixFilePath(name, file);
          push(file);
          html[i] += '<link rel="import" href="' + _fixUrlForRevReplace(name.replace(path.basename(name), path.basename(file.path))) + '"/>';
          resolve();
        }.bind(this, block.nameInHTML));
      }
    });
  });

  Promise.all(promises).then(function() {
    var createdFile = createFile(name, html.join(''));
    pipeline(createdFile.path, [createdFile], options && options['html'], function(file) {
      callback(null, file);
    });
  });
};
