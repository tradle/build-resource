const clone = require('clone')
const deepEqual = require('deep-equal')
const extend = require('xtend/mutable')
const { constants } = require('@tradle/engine')
const validateModels = require('@tradle/validate-model')
const validateModel = validateModels.model
const validateResource = require('@tradle/validate-resource')
const validateResourceProperty = validateResource.property
const { TYPE, SIG } = constants
const utils = require('./utils')

module.exports = builder

function builder ({ models, model, resource }) {
  validateModel(model)
  const { properties } = model

  resource = extend({
    [SIG]: '__sigplaceholder__',
    [TYPE]: model.id
  }, clone(resource))

  const api = {
    set,
    get,
    add,
    remove,
    filterOut,
    toJSON
  }

  return api

  function get (propertyName) {
    return propertyName ? clone(resource[propertyName]) : toJSON()
  }

  function getProperty (propertyName) {
    const prop = properties[propertyName]
    if (!prop) {
      throw new Error(`model ${model.id} has no property ${propertyName}`)
    }

    return prop
  }

  function getArrayProperty (propertyName) {
    const prop = getProperty(propertyName)
    if (prop.type !== 'array') {
      throw new Error(`model ${model.id} property ${propertyName} is not an array`)
    }

    return prop
  }

  function checkValue (propertyName, value) {
    if (typeof value === 'undefined' || value == null) {
      throw new Error(`invalid value ${value} for property ${propertyName}`)
    }
  }

  function add (propertyName, value) {
    const prop = getArrayProperty(propertyName)
    const current = resource[propertyName] || []
    set(propertyName, current.concat(value))
    return api
  }

  function filterOut (propertyName, test) {
    const prop = getArrayProperty(propertyName)
    const current = resource[propertyName] || []
    resource[propertyName] = current.filter(val => !test(val))
    return api
  }

  function remove (propertyName, value) {
    const prop = getArrayProperty(propertyName)
    const current = resource[propertyName] || []
    const idx = resource[propertyName].findIndex(function (item) {
      return deepEqual(item, value)
    })

    if (idx === -1) {
      throw new Error('value not found')
    }

    resource[propertyName] = current.filter((val, i) => i !== idx)
    return api
  }

  function set (propertyName, value) {
    if (typeof propertyName === 'object') {
      for (let key in propertyName) {
        set(key, propertyName[key])
      }

      return api
    }

    const prop = getProperty(propertyName)
    checkValue(propertyName, value)

    if (prop.type === 'array' && !prop.inlined) {
      value = utils.array({ models, model, propertyName, value })
    }

    if (prop.type === 'object' && !prop.inlined && prop.ref && !value.id) {
      value = utils.stub({ models, model, propertyName, resource: value })
    }

    validateResourceProperty({ models, model, propertyName, value })
    resource[propertyName] = value
    return api
  }

  function toJSON () {
    validateResource({ models, model, resource })
    const copy = clone(resource)
    delete copy[SIG]
    return copy
  }
}
