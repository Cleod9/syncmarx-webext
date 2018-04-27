function Logger(prefix) {
  this.prefix = prefix || '';
}

// Enable/disable logging
Logger.ENABLED = true;

Logger.prototype.prefix = '';

Logger.prototype.log = function() {
  if (!Logger.ENABLED ) {
    return;
  }
  var args = [].slice.call(arguments);
  args.unshift(this.prefix);
  console.log.apply(console, args);
}
Logger.prototype.info = function() {
  if (!Logger.ENABLED ) {
    return;
  }
  var args = [].slice.call(arguments);
  args.unshift(this.prefix);
  console.info.apply(console, args);
}
Logger.prototype.warn = function() {
  if (!Logger.ENABLED ) {
    return;
  }
  var args = [].slice.call(arguments);
  args.unshift(this.prefix);
  console.warn.apply(console, args);
}
Logger.prototype.error = function() {
  if (!Logger.ENABLED ) {
    return;
  }
  var args = [].slice.call(arguments);
  args.unshift(this.prefix);
  console.error.apply(console, args);
}

module.exports = Logger;
