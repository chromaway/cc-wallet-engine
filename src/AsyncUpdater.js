var events = require('events')
var util = require('util')


/**
 * @callback AsyncUpdater~updateFn
 * @param {function} fn
 */

/**
 * @class AsyncUpdater
 * @param {AsyncUpdater~updateFn} updateFn
 */
function AsyncUpdater(updateFn) {
  this._stillNeedsUpdating = false
  this._isUpdating = false
  this._updateFn = updateFn
  this._updateDelay = 100
}

util.inherits(AsyncUpdater, events.EventEmitter)

/**
 */
AsyncUpdater.prototype._scheduleUpdate = function () {
  var self = this
  setTimeout(function () {
    self._updateFn(function () {
      if (self._stillNeedsUpdating) {
        self._stillNeedsUpdating = false
        return self._scheduleUpdate()
      }

      self._isUpdating = false
      self.emit('endUpdating')
    })

  }, this._updateDelay)
}

/**
 */
AsyncUpdater.prototype.notifyNeedsUpdate = function () {
  if (this._isUpdating) {
    return this._stillNeedsUpdating = true
  }

  this._isUpdating = true
  this.emit('beginUpdating')
  this._scheduleUpdate()
}

/**
 * @return {boolean}
 */
AsyncUpdater.prototype.isUpdating = function () {
  return this._isUpdating
}


module.exports = AsyncUpdater
