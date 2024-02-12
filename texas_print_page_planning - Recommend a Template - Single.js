let inputConfig = input.config();

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
let templatesTable = await base.getTable("Templates");
let templates = await templatesTable.selectRecordsAsync({ 
  fields: ["Name"],
    sorts: [
       {field: "Priority Order"},
       {field: "Name"},
    ] 
  });
//console.log(templates);
let mapOfUniqueIdToTemplates = createMappingOfUniqueFieldToRecordId(templates.records, "Name");

let pageTable = await base.getTable("Layout");
let templateStatus = null;
let previousTemplateStatus = null;

//console.log(mapOfUniqueIdToTemplates);
let thisTemplateStatus = `${inputConfig.thisTemplateStatus}`;
let thisPreviousTemplateStatus = `${inputConfig.thisPreviousTemplateStatus}`;
let templateFormula = `${inputConfig.templateFormula}`;
templateFormula = templateFormula.replace('*','.*');
const regex = new RegExp(templateFormula,"i");
//console.log(regex);

let recommendedTemplate = "❌No Match";
let suggestedTemplate = "rec93nIBDXILIUi3m";
for (const key in mapOfUniqueIdToTemplates) {
    const found = key.match(regex);
    if (found !== null) {
      //find the first match and suggest it, may need to set up priority ordering
      console.log("Template match found for "+regex+" suggesting: "+found);
      recommendedTemplate = key;
      suggestedTemplate = mapOfUniqueIdToTemplates[key];
      break;
    }
}

let standardEnrichment = `${inputConfig.standardEnrichment}`;
//console.log(standardEnrichment);
if (`${inputConfig.manuallySelected}` != 'Manual Selection') {
  if (standardEnrichment !== "null") {
    console.log('Standard Enrichment: detected');
    suggestedTemplate = "recaFzxWVMDO3frVj";
  } else {
    //check if there is a plan to enrich
    let enrichTable = base.getTable('Plan Enrich');
    let enrichView = enrichTable.getView('Active Layout - test');
    let queryEnrichResult = await enrichView.selectRecordsAsync({
        fields: [ "Zone", "Edition", "Weekday", "Template", "Page Name"],
        sorts: [
          {field: "Zone"},
          {field: "Page Name"},
        ]
    });
    for (let enrichRecord of queryEnrichResult.records) {
      let enrichRecordPageName = enrichRecord.getCellValueAsString("Page Name");
      enrichRecordPageName = enrichRecordPageName.replace('*','.*');
      var enrichPageNameRegex = new RegExp(enrichRecordPageName,"g");
      let enrichRecordZone = enrichRecord.getCellValueAsString("Zone");
      let enrichRecordDow = enrichRecord.getCellValueAsString("Weekday");
      let enrichRecordEdition = enrichRecord.getCellValueAsString("Edition");
      let enrichRecordTemplate = enrichRecord.getCellValueAsString("Template");

      let thisRecordId = `${inputConfig.thisRecordId}`;
      let thisPageName = `${inputConfig.thisPageName}`;
      let thisZone = `${inputConfig.thisZone}`;
      let thisEdition = `${inputConfig.thisEdition}`;
      let thisDow = `${inputConfig.thisDow}`;
      if (
            thisPageName.match(enrichPageNameRegex) &&
            thisZone == enrichRecordZone &&
            thisEdition == enrichRecordEdition &&
            enrichRecordDow.includes(thisDow)
      ) {
          console.log('FOUND A MATCH!');
          console.log(enrichPageNameRegex);
          //update the record
          pageTable.updateRecordAsync(thisRecordId,
          {"Plan Enrich": enrichRecordTemplate})
          suggestedTemplate = "recaFzxWVMDO3frVj";
          break;
      }
    }
  }
}

console.log("Recommending: "+recommendedTemplate+" : "+suggestedTemplate);
let update;
if (`${inputConfig.manuallySelected}` != 'Manual Selection') {
  update = {
        'Recommended Template': recommendedTemplate,
        'Template List': [{id:suggestedTemplate}],
        'Previous Template': [{id:suggestedTemplate}]
    };
} else {
  update = {
        'Recommended Template': recommendedTemplate,
    };
  templateStatus = {name:"Manual Selection"};
  previousTemplateStatus = "Manual Selection";
}
if (templateFormula == 'AdsOnly' || standardEnrichment !== "null") {
  templateStatus = {name:"LOCKED"};
  previousTemplateStatus = "LOCKED";
  update['XML Status'] = {name: "No Action"};
} else if (
  thisPreviousTemplateStatus == 'null' &&
  thisTemplateStatus == 'null'
) {
  update['Template Status'] = templateStatus;
  update['Previous Template Status'] = previousTemplateStatus;
} else {
  templateStatus = {name: thisTemplateStatus};
  previousTemplateStatus = thisPreviousTemplateStatus;
}
console.log(update);
pageTable.updateRecordAsync(
  `${inputConfig.thisRecordId}`,
  update
);
