var ghToken = '<TOKEN_WITH_REPO_WRITE_RIGHTS>';
var repo = '<REPO_FOR_ISSUES>';

var columnTitlesIndexMap = {
  Timestamp: 0,  
  Email_Address: 1,	
  Priority: 2,
  Category: 3,
  Category_Application: 4,	
  Category_Integration: 5,	
  Customer_Email: 6,	
  Customer_Notes: 7,	
  Steps: 8,
  Expected_Behaviour: 9,	
  Actual_Behaviour: 10,	
  Attachments: 11,
  Brief_Description: 12
};  

var bodyTemplate = '\
### Customer Information\n\
{{customer}}\n\
### Application/Feature\n\
{{category}}\n\
### Steps to reproduce\n\
{{steps}}\n\
### Expected Behaviour\n\
{{expected}}\n\
### Actual Behaviour\n\
{{actual}}\n\
\n\
{{attachments}}\
\n\
Reported by {{reporter}}\
';



function onFormSubmit(e) {
  var payloadBuilder = new PayloadBuilderFactory(e.values)
    .addTitle()
    .addBody()
    .addLabels()
     
  var options = {
    "method": "POST",
    "contentType": "application/json",
    "payload": payloadBuilder.toString()
  };
  
  UrlFetchApp.fetch('https://api.github.com/repos/' + repo + '/issues?access_token=' + ghToken, options);
}

function PayloadBuilderFactory(row, ops) {
  var payload = ops || {};

  this.addTitle = addTitle.bind(this, payload, row);
  this.addBody = addBody.bind(this, payload, row);
  this.addLabels = addLabels.bind(this, payload, row);
  
  this.toString = JSON.stringify.bind(JSON, payload);
  
  return this;
}


function addTitle(payload, row) {
  payload.title = row[columnTitlesIndexMap.Brief_Description];
  return this;
}

function addBody(payload, row) {
  var customer = [
    row[columnTitlesIndexMap.Customer_Email],
    row[columnTitlesIndexMap.Customer_Notes]
  ].filter(function (val) { return !!val; }).join('\n\n');
  
  var category = [
    row[columnTitlesIndexMap.Category].split(' (')[0],
    row[columnTitlesIndexMap.Category_Application],
    row[columnTitlesIndexMap.Category_Integration]
  ].filter(function (val) { return !!val; }).join(' / ');
  
  var steps = row[columnTitlesIndexMap.Steps];
  var expected = row[columnTitlesIndexMap.Expected_Behaviour];
  var actual = row[columnTitlesIndexMap.Actual_Behaviour];
  
  var attachments = row[columnTitlesIndexMap.Attachments].split(',')
    .map(function (val) { return val.trim(); })
    .filter(function (val) { return !!val; })
    .map(function (val) { return val.split('id=')[1]; })
    .map(function (id) { 
      var file = DriveApp.getFileById(id);
      var blob = file.getBlob();
      var content = Utilities.base64Encode(blob.getBytes());
      var path = 'assets/' + encodeURIComponent((+new Date()).toString() + '-' + file.getName());

      var options = {
        'method': 'PUT',
        'contentType': 'application/json',
        'payload': JSON.stringify({
          'message': 'transferred from google drive',
          'content': content
        })
      };
      
      UrlFetchApp.fetch('https://api.github.com/repos/' + repo + '/contents/' + path + '?access_token=' + ghToken, options);
            
      return '../blob/master/' + path + '?raw=true'; 
    })
    .map(function (val) { return '![' + val + '](' + val + ')'; })
    .join('\n');
  ;
  
  var reporter = row[columnTitlesIndexMap.Email_Address];
  
  var body = bodyTemplate
    .replace('{{customer}}', customer)
    .replace('{{category}}', category)
    .replace('{{steps}}', steps)
    .replace('{{expected}}', expected)
    .replace('{{actual}}', actual)
    .replace('{{attachments}}', attachments)
    .replace('{{reporter}}', reporter)
  ;

  payload.body = body;
  
  return this;
}

function addLabels(payload, row) {
  var categoryCell = row[columnTitlesIndexMap.Category].split(' (')[0].toLowerCase();
  var categories = [];
  if (['application', 'integration', 'other'].indexOf(categoryCell) === -1) {
    categories.push(categoryCell);
  }

  var applicationCell = row[columnTitlesIndexMap.Category_Application].toLowerCase();
  var applications = [];
  if (!!~applicationCell.indexOf('mobile')) {
    applications.push('mobile');
  }
  if (!!~applicationCell.indexOf('web')) {
    applications.push('web');
  }

  var integrationCell = row[columnTitlesIndexMap.Category_Integration].toLowerCase();
  var integrations = [];
  if (integrationCell !== 'other') {
    integrations.push(integrationCell);
  }
  
  var priorities = [
    row[columnTitlesIndexMap.Priority].toLowerCase()
  ];
  
  var labels = []
    .concat(categories)
    .concat(applications)
    .concat(integrations)
    .concat(priorities)
    .filter(function (val) { return !!val; })
    .map(function (val) { return val.toLowerCase(); })
  ;
  
  payload.labels = (payload.labels || []).concat(labels);
  
  return this;
}
