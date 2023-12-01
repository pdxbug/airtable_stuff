// helper function (provided by Airtable)
// This creates a map object of primary field and record ID
// this is used to create a simple way of matching against existing records
// example: { FeatureX-AccountY: "recWer23radda" }
const createMappingOfUniqueFieldToRecordId = function (records, fieldName) {
  const mapping = {}
  for (const existingRecord of records) {
    mapping[existingRecord.getCellValueAsString(fieldName)] = existingRecord.id
  }
  return mapping
}

let inputConfig = input.config();
let thisWcmId = `${inputConfig.thisWcmId}`;
let thisRecord = `${inputConfig.thisRecordId}`;
//console.log(mapOfUnassignedRecords);

let wcmToCueTable = base.getTable('Stories WCM to Cue');

let budgetTable = base.getTable('WCM to Cue Print Budgeting');
let unassignedView = budgetTable.getView("All");
let unassignedBudgetItems = await unassignedView.selectRecordsAsync({fields: ["WCM ID"]});
let mapOfUnassignedBudgetItems = createMappingOfUniqueFieldToRecordId(unassignedBudgetItems.records, 'WCM ID');

if(mapOfUnassignedBudgetItems[thisWcmId]) {
  await wcmToCueTable.updateRecordAsync(thisRecord, {"WCM to Cue Print Budgeting":[{id:mapOfUnassignedBudgetItems[thisWcmId]}]});
  console.log('Found and Linked');
}
