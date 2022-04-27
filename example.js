const models = require('@tradle/models')
const buildResource = require('./')
const resource = buildResource({
    models,
    model: models['tradle.PersonalInfo']
  })
  .firstName('ted')
  .lastName('logan')
  // ted was born yesterday
  .dateOfBirth('11/22/1963')
  .placeOfBirth('San Dimas')
  .emailAddress('ted@wyldstallyns.com')
  .maritalStatus({
    id: 'tradle.MaritalStatus',
    title: 'Married'
  })
  .education({
    id: 'tradle.EducationNL',
    title: 'Ph. D in superheroism'
  })
  .nationality({
    id: 'tradle.Nationality',
    title: 'American'
  })
  .phones([
    {
      "_t": "tradle.Phone",
      "number": "0123456789",
      "phoneType": {
        "id": "tradle.PhoneTypes",
        "title": "Mobile"
      }
    }
  ])
  .toJSON()

console.log(JSON.stringify(resource, null, 2))
