var PluginError = require('gulp-util').PluginError;
var Transform = require('stream').Transform;
var Path = require('path');

var gutil = require('gulp-util');
var postcss = require('postcss');

module.exports = function(opts) {
  opts = opts || {};

  function parsePath(path) {
    var extname = Path.extname(path);
    return {
      dirname: Path.dirname(path),
      basename: Path.basename(path, extname),
      extname: extname
    };
  }

  var stream = new Transform({objectMode: true});

  stream._transform = function(file, encoding, cb) {
    if (file.isNull()) {
      return cb(null, file);
    }
    if (file.isStream()) {
      var error = 'Streaming not supported';
      return cb(new PluginError(PLUGIN_NAME, error));
    } else if (file.isBuffer()) {
      var css = postcss.parse(String(file.contents));
      var parsedFile = parsePath(file.path);
      var newCss = postcss.parse('@charset "UTF-8"');
      var nodesCount = 0;
      var oldRules = [];

      // let's loop through all rules and extract all @media print
      css.walkAtRules(function(rule) {
        var hasMatch = false;
        if (rule.name.match(/^media/)) {
          if (opts.min) {
            var matchMin = rule.params.match(/\(\s*min-width:\s*(\d+)px\s*\)/);
          }

          if (opts.max) {
            var matchMax = rule.params.match(/\(\s*max-width:\s*(\d+)px\s*\)/);
          }

          if (opts.min && opts.max) {
            if (matchMin && matchMin[1] >= opts.min && matchMax && matchMax[1] <= opts.max) {
              hasMatch = true;
            }
          } else if (opts.min) {
            if (matchMin && matchMin[1] >= opts.min) {
              hasMatch = true;
            }
          } else if (opts.max) {
            if (matchMax && matchMax[1] <= opts.max) {
              hasMatch = true;
            }
          }

          if (hasMatch) {
            newCss.append(rule.clone());
            nodesCount += rule.nodes.length;
            oldRules.push(rule);
          }
        }
      });


      if (nodesCount > opts.minNodes) {
        // push old file
        oldRules.forEach(function (rule) {
            rule.remove();
        });

        file.contents = new Buffer(css.toString());
        this.push(file);

        this.push(new gutil.File({
          cwd: file.cwd,
          base: file.base,
          path: parsedFile.dirname + '/' + parsedFile.basename + opts.postfix + parsedFile.extname,
          contents: new Buffer(newCss.toString())
        }));
      } else {
        this.push(file);
      }

      cb();
    }
  }
  return stream;
}
