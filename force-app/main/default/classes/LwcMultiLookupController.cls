/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : LwcMultiLookupController
 * Author          : Anwar Chikle
 * Created Date    : Jan 21, 2026
 * Last Modified By: 
 * Last Modified On: Jan 21, 2026
 * Description     : This class implements for......
 *  
 * Change History  :
 *  Date          │   Author     │   Change
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Jan 21, 2026  │ Anwar Chikle   │ Initial version
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */

public with sharing class LwcMultiLookupController {
    public LwcMultiLookupController() {

    }
    @AuraEnabled(cacheable=true)
    public static List<SObJectResult> getResults(String ObjectName, String fieldName, String value, List<String> selectedRecId) {
        List<SObJectResult> sObjectResultList = new List<SObJectResult>();
        system.debug(fieldName+'-------------'+ObjectName+'---++----------'+value+'====='+selectedRecId);
        if(selectedRecId == null)
            selectedRecId = new List<String>();

        if(String.isNotEmpty(value)) {
            String query = 'Select Id,Name,'+fieldName+' FROM '+ObjectName+' WHERE ( Name LIKE  \'%' + value.trim() + '%\') and ID NOT IN: selectedRecId LIMIT 20';
            System.debug('query ====>' + query);
           // String query = 'Select Id,Name,'+fieldName+' FROM '+ObjectName+' WHERE ( '+fieldName+' LIKE \'%' + value.trim() + '%\' OR Name LIKE  \'%' + value.trim() + '%\') and ID NOT IN: selectedRecId';
            system.debug(query);
            for(sObject so : Database.Query(query)) {
                String fieldvalue = (String)so.get(fieldName);
                String name = (String)so.get('Name');
                sObjectResultList.add(new SObjectResult(fieldvalue, so.Id, name));
            }
        }
        return sObjectResultList;
    }
    
    public class SObjectResult {
        @AuraEnabled
        public String recName;
        @AuraEnabled
        public Id recId;
        @AuraEnabled
        public String name;
        
        public SObJectResult(String recNameTemp, Id recIdTemp, String name) {
            recName = recNameTemp;
            recId = recIdTemp;
            this.name = name;
        }
        public SObJectResult() {
          
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<sObject> getLookupValues(  String searchKeyWord, String objectAPIName, String whereCondition, String fieldNames, Integer customLimit ) {
        try{
            String searchKey = '%'+ searchKeyWord + '%';        
            List<sObject> returnList = new List<sObject>();
            String sQuery = 'SELECT Id, Name ';
            if(String.isNotBlank(fieldNames) && !fieldNames.equalsIgnoreCase('Name')) {
                sQuery += ','+fieldNames;
            }
            if(String.isNotBlank(whereCondition) && whereCondition != null){
                sQuery +=  ' FROM ' +objectAPIName + ' WHERE ' + fieldNames + ' LIKE \''+searchKey+'\' AND ' + whereCondition + ' ORDER BY CreatedDate DESC limit ' + String.valueOf(customLimit);
            } else {
                sQuery +=  ' FROM ' +objectAPIName + ' WHERE ' + fieldNames + ' LIKE \''+searchKey+'\' ORDER BY CreatedDate DESC limit ' + String.valueOf(customLimit);
            }
            system.debug('sQuery === >'+sQuery);
            List<sObject> lstOfRecords = Database.query(sQuery);
            for (sObject obj: lstOfRecords) { returnList.add(obj); }
            system.debug('lstOfRecords === >'+lstOfRecords) ;
            return returnList;
        }catch(Exception e){
            System.debug('The Error ::'+e.getMessage() +' AND Error Line No :'+e.getLineNumber());
        }
        return null;
    }

    @AuraEnabled(cacheable=true)
    public static List<sObject> gerRecentlyCreatedRecords( String objectAPIName, String fieldNames, String whereCondition, Integer customLimit){
        try{
            List<sObject> returnList = new List<sObject>();
            String sQuery = 'SELECT Id, Name ';
            if(String.isNotBlank(fieldNames) && !fieldNames.equalsIgnoreCase('Name')) {
                sQuery += ','+fieldNames;
            }
            if(String.isNotBlank(whereCondition) && whereCondition != null){
                sQuery +=  ' FROM ' +objectAPIName + ' WHERE ' + whereCondition + ' ORDER BY CreatedDate DESC limit ' + String.valueOf(customLimit);
            } else {
                sQuery +=  ' FROM ' +objectAPIName + ' ORDER BY CreatedDate DESC limit ' + String.valueOf(customLimit);
            }
            system.debug('sQuery 1 === >'+sQuery) ;
            List<sObject> lstOfRecords = Database.query(sQuery);
            for (sObject obj: lstOfRecords) { returnList.add(obj); }
            return returnList;
        }catch(Exception e){
            System.debug('The Error ::'+e.getMessage() +' AND Error Line No :'+e.getLineNumber());
        }
        return null;
    }

    @AuraEnabled(cacheable=true)
    public static sObject getinitRecord(String recordId, String objectAPIName, String fieldNames) {
        try{
            String sRecId = recordId;    
            String sQuery = 'SELECT id, Name ';
            if(String.isNotBlank(fieldNames)) {
                sQuery += ','+fieldNames;
            }
            sQuery +=  ' FROM ' + objectAPIName + ' WHERE Id = : sRecId LIMIT 1 ';
            for (sObject obj: Database.query(sQuery)) {
                return obj;
            }
        }catch(Exception e){
            System.debug('The Error ::'+e.getMessage() +' AND Error Line No :'+e.getLineNumber());
        }
        return null;
    }
}