const clone = require('clone')
const deepEqual = require('deep-equal')
const extend = require('xtend/mutable')
const { TYPE, SIG, PREVLINK, PERMALINK } = require('@tradle/constants')
const validateModels = require('@tradle/validate-model')
const validateModel = validateModels.model
const validateResource = require('@tradle/validate-resource')
const validateResourceProperty = validateResource.property
const ObjectModel = require('@tradle/models').models['tradle.Object']
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
    previous,
    original,
    toJSON
  }

  return api

  function get (propertyName) {
    return propertyName ? clone(resource[propertyName]) : toJSON()
  }

  function getProperty (propertyName) {
    const prop = properties[propertyName] || ObjectModel.properties[propertyName]
    if (!prop) {
      throw new Error(`model ${model.id} has no property ${propertyName}`)
    }

    return prop
  }

  function checkValue (propertyName, value) {
    if (typeof value === 'undefined' || value == null) {
      throw new Error(`invalid value ${value} for property ${propertyName}`)
    }
  }

  function add (propertyName, value) {
    const current = resource[propertyName] || []
    set(propertyName, current.concat(value))
    return api
  }

  function filterOut (propertyName, test) {
    const current = resource[propertyName] || []
    resource[propertyName] = current.filter(val => !test(val))
    return api
  }

  function remove (propertyName, value) {
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

    // console.log(propertyName, prop, prop.ref && models[prop.ref].subClassOf)
    if (prop.ref && models[prop.ref].subClassOf === 'tradle.Enum') {
      if (!value.startsWith(prop.ref + '_')) {
        value = `${prop.ref}_${value}`
      }
    } else if (prop.type === 'array' && !prop.inlined) {
      value = utils.array({ models, model, propertyName, value })
    } else if (prop.type === 'object' && !prop.inlined && prop.ref && !value.id) {
      value = utils.stub({ models, model, propertyName, resource: value })
    }

    validateResourceProperty({ models, model, propertyName, value })
    resource[propertyName] = value
    return api
  }

  function previous (link) {
    return set(PREVLINK, link)
  }

  function original (link) {
    return set(PERMALINK, link)
  }

  function toJSON () {
    validateResource({ models, model, resource })
    const copy = clone(resource)
    delete copy[SIG]
    return copy
  }
}
