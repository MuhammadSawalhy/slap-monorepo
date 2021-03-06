(function() {
  var Directory, Disposable, Emitter, EmitterMixin, File, Grim, PathWatcher, async, fs, path, _ref,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __slice = [].slice;

  path = require('path');

  async = require('async');

  _ref = require('event-kit'), Emitter = _ref.Emitter, Disposable = _ref.Disposable;

  fs = require('fs-plus');

  Grim = require('grim');

  File = require('./file');

  PathWatcher = require('./main');

  module.exports = Directory = (function() {
    Directory.prototype.realPath = null;

    Directory.prototype.subscriptionCount = 0;


    /*
    Section: Construction
     */

    function Directory(directoryPath, symlink, includeDeprecatedAPIs) {
      this.symlink = symlink != null ? symlink : false;
      if (includeDeprecatedAPIs == null) {
        includeDeprecatedAPIs = Grim.includeDeprecatedAPIs;
      }
      this.didRemoveSubscription = __bind(this.didRemoveSubscription, this);
      this.willAddSubscription = __bind(this.willAddSubscription, this);
      this.emitter = new Emitter;
      if (includeDeprecatedAPIs) {
        this.on('contents-changed-subscription-will-be-added', this.willAddSubscription);
        this.on('contents-changed-subscription-removed', this.didRemoveSubscription);
      }
      if (directoryPath) {
        directoryPath = path.normalize(directoryPath);
        if (directoryPath.length > 1 && directoryPath[directoryPath.length - 1] === path.sep) {
          directoryPath = directoryPath.substring(0, directoryPath.length - 1);
        }
      }
      this.path = directoryPath;
      if (fs.isCaseInsensitive()) {
        this.lowerCasePath = this.path.toLowerCase();
      }
      if (Grim.includeDeprecatedAPIs) {
        this.reportOnDeprecations = true;
      }
    }

    Directory.prototype.create = function(mode) {
      if (mode == null) {
        mode = 0x1ff;
      }
      return this.exists().then((function(_this) {
        return function(isExistingDirectory) {
          if (isExistingDirectory) {
            return false;
          }
          if (_this.isRoot()) {
            throw Error("Root directory does not exist: " + (_this.getPath()));
          }
          return _this.getParent().create().then(function() {
            return new Promise(function(resolve, reject) {
              return fs.mkdir(_this.getPath(), mode, function(error) {
                if (error) {
                  return reject(error);
                } else {
                  return resolve(true);
                }
              });
            });
          });
        };
      })(this));
    };


    /*
    Section: Event Subscription
     */

    Directory.prototype.onDidChange = function(callback) {
      this.willAddSubscription();
      return this.trackUnsubscription(this.emitter.on('did-change', callback));
    };

    Directory.prototype.willAddSubscription = function() {
      if (this.subscriptionCount === 0) {
        this.subscribeToNativeChangeEvents();
      }
      return this.subscriptionCount++;
    };

    Directory.prototype.didRemoveSubscription = function() {
      this.subscriptionCount--;
      if (this.subscriptionCount === 0) {
        return this.unsubscribeFromNativeChangeEvents();
      }
    };

    Directory.prototype.trackUnsubscription = function(subscription) {
      return new Disposable((function(_this) {
        return function() {
          subscription.dispose();
          return _this.didRemoveSubscription();
        };
      })(this));
    };


    /*
    Section: Directory Metadata
     */

    Directory.prototype.isFile = function() {
      return false;
    };

    Directory.prototype.isDirectory = function() {
      return true;
    };

    Directory.prototype.isSymbolicLink = function() {
      return this.symlink;
    };

    Directory.prototype.exists = function() {
      return new Promise((function(_this) {
        return function(resolve) {
          return fs.exists(_this.getPath(), resolve);
        };
      })(this));
    };

    Directory.prototype.existsSync = function() {
      return fs.existsSync(this.getPath());
    };

    Directory.prototype.isRoot = function() {
      return this.getParent().getRealPathSync() === this.getRealPathSync();
    };


    /*
    Section: Managing Paths
     */

    Directory.prototype.getPath = function() {
      return this.path;
    };

    Directory.prototype.getRealPathSync = function() {
      var e;
      if (this.realPath == null) {
        try {
          this.realPath = fs.realpathSync(this.path);
          if (fs.isCaseInsensitive()) {
            this.lowerCaseRealPath = this.realPath.toLowerCase();
          }
        } catch (_error) {
          e = _error;
          this.realPath = this.path;
          if (fs.isCaseInsensitive()) {
            this.lowerCaseRealPath = this.lowerCasePath;
          }
        }
      }
      return this.realPath;
    };

    Directory.prototype.getBaseName = function() {
      return path.basename(this.path);
    };

    Directory.prototype.relativize = function(fullPath) {
      var directoryPath, pathToCheck;
      if (!fullPath) {
        return fullPath;
      }
      if (process.platform === 'win32') {
        fullPath = fullPath.replace(/\//g, '\\');
      }
      if (fs.isCaseInsensitive()) {
        pathToCheck = fullPath.toLowerCase();
        directoryPath = this.lowerCasePath;
      } else {
        pathToCheck = fullPath;
        directoryPath = this.path;
      }
      if (pathToCheck === directoryPath) {
        return '';
      } else if (this.isPathPrefixOf(directoryPath, pathToCheck)) {
        return fullPath.substring(directoryPath.length + 1);
      }
      this.getRealPathSync();
      if (fs.isCaseInsensitive()) {
        directoryPath = this.lowerCaseRealPath;
      } else {
        directoryPath = this.realPath;
      }
      if (pathToCheck === directoryPath) {
        return '';
      } else if (this.isPathPrefixOf(directoryPath, pathToCheck)) {
        return fullPath.substring(directoryPath.length + 1);
      } else {
        return fullPath;
      }
    };

    Directory.prototype.resolve = function(relativePath) {
      if (!relativePath) {
        return;
      }
      if (relativePath != null ? relativePath.match(/[A-Za-z0-9+-.]+:\/\//) : void 0) {
        return relativePath;
      } else if (fs.isAbsolute(relativePath)) {
        return path.normalize(fs.resolveHome(relativePath));
      } else {
        return path.normalize(fs.resolveHome(path.join(this.getPath(), relativePath)));
      }
    };


    /*
    Section: Traversing
     */

    Directory.prototype.getParent = function() {
      return new Directory(path.join(this.path, '..'));
    };

    Directory.prototype.getFile = function() {
      var filename;
      filename = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return new File(path.join.apply(path, [this.getPath()].concat(__slice.call(filename))));
    };

    Directory.prototype.getSubdirectory = function() {
      var dirname;
      dirname = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return new Directory(path.join.apply(path, [this.path].concat(__slice.call(dirname))));
    };

    Directory.prototype.getEntriesSync = function() {
      var directories, entryPath, files, stat, symlink, _i, _len, _ref1;
      directories = [];
      files = [];
      _ref1 = fs.listSync(this.path);
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        entryPath = _ref1[_i];
        try {
          stat = fs.lstatSync(entryPath);
          symlink = stat.isSymbolicLink();
          if (symlink) {
            stat = fs.statSync(entryPath);
          }
        } catch (_error) {}
        if (stat != null ? stat.isDirectory() : void 0) {
          directories.push(new Directory(entryPath, symlink));
        } else if (stat != null ? stat.isFile() : void 0) {
          files.push(new File(entryPath, symlink));
        }
      }
      return directories.concat(files);
    };

    Directory.prototype.getEntries = function(callback) {
      return fs.list(this.path, function(error, entries) {
        var addEntry, directories, files, statEntry;
        if (error != null) {
          return callback(error);
        }
        directories = [];
        files = [];
        addEntry = function(entryPath, stat, symlink, callback) {
          if (stat != null ? stat.isDirectory() : void 0) {
            directories.push(new Directory(entryPath, symlink));
          } else if (stat != null ? stat.isFile() : void 0) {
            files.push(new File(entryPath, symlink));
          }
          return callback();
        };
        statEntry = function(entryPath, callback) {
          return fs.lstat(entryPath, function(error, stat) {
            if (stat != null ? stat.isSymbolicLink() : void 0) {
              return fs.stat(entryPath, function(error, stat) {
                return addEntry(entryPath, stat, true, callback);
              });
            } else {
              return addEntry(entryPath, stat, false, callback);
            }
          });
        };
        return async.eachLimit(entries, 1, statEntry, function() {
          return callback(null, directories.concat(files));
        });
      });
    };

    Directory.prototype.contains = function(pathToCheck) {
      var directoryPath;
      if (!pathToCheck) {
        return false;
      }
      if (process.platform === 'win32') {
        pathToCheck = pathToCheck.replace(/\//g, '\\');
      }
      if (fs.isCaseInsensitive()) {
        directoryPath = this.lowerCasePath;
        pathToCheck = pathToCheck.toLowerCase();
      } else {
        directoryPath = this.path;
      }
      if (this.isPathPrefixOf(directoryPath, pathToCheck)) {
        return true;
      }
      this.getRealPathSync();
      if (fs.isCaseInsensitive()) {
        directoryPath = this.lowerCaseRealPath;
      } else {
        directoryPath = this.realPath;
      }
      return this.isPathPrefixOf(directoryPath, pathToCheck);
    };


    /*
    Section: Private
     */

    Directory.prototype.subscribeToNativeChangeEvents = function() {
      return this.watchSubscription != null ? this.watchSubscription : this.watchSubscription = PathWatcher.watch(this.path, (function(_this) {
        return function(eventType) {
          if (eventType === 'change') {
            if (Grim.includeDeprecatedAPIs) {
              _this.emit('contents-changed');
            }
            return _this.emitter.emit('did-change');
          }
        };
      })(this));
    };

    Directory.prototype.unsubscribeFromNativeChangeEvents = function() {
      if (this.watchSubscription != null) {
        this.watchSubscription.close();
        return this.watchSubscription = null;
      }
    };

    Directory.prototype.isPathPrefixOf = function(prefix, fullPath) {
      return fullPath.indexOf(prefix) === 0 && fullPath[prefix.length] === path.sep;
    };

    return Directory;

  })();

  if (Grim.includeDeprecatedAPIs) {
    EmitterMixin = require('emissary').Emitter;
    EmitterMixin.includeInto(Directory);
    Directory.prototype.on = function(eventName) {
      if (eventName === 'contents-changed') {
        Grim.deprecate("Use Directory::onDidChange instead");
      } else if (this.reportOnDeprecations) {
        Grim.deprecate("Subscribing via ::on is deprecated. Use documented event subscription methods instead.");
      }
      return EmitterMixin.prototype.on.apply(this, arguments);
    };
  }

}).call(this);
