import { publicServiceChoices } from './serviceCatalog';
test('search choices group legacy labels while retaining unrelated custom services', () => {
  const choices = publicServiceChoices([{id:'legacy',label:'Child care'}, {id:'catalog_child_care_babysitting',label:'Child Care / Babysitting'}, {id:'custom-a',label:'Cooking lesson'}, {id:'custom-b',label:'Companion outing'}, {id:'inactive',label:'Hidden',isActive:false}]);
  expect(choices.map(item => item.id)).toEqual(['catalog_child_care_babysitting','custom-a','custom-b']);
});
