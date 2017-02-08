const models = require('@tradle/models')
const buildResource = require('./')
const DAY_MILLIS = 24 * 3600 * 1000
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
    id: 'tradle.MaritalStatus_4b3d018c5085bc93de73405760a5d2fbcbef6c78de73405760a5d2fbcbef6c78',
    title: 'Married'
  })
  .education({
    id: 'tradle.EducationNL_4b3d018c5085bc93de73405760a5d2fbcbef6c78de73405760a5d2fbcbef6c78',
    title: 'Ph. D in superheroism'
  })
  .nationality({
    id: 'tradle.Nationality_4b3d018c5085bc93de73405760a5d2fbcbef6c78de73405760a5d2fbcbef6c78',
    title: 'American'
  })
  .phones([
    {
      "_t": "tradle.Phone",
      "number": "0123456789",
      "phoneType": {
        "id": "tradle.PhoneTypes_4b3d018c5085bc93de73405760a5d2fbcbef6c78de73405760a5d2fbcbef6c78",
        "title": "Mobile"
      }
    }
  ])
  .toJSON()

console.log(JSON.stringify(resource, null, 2))
