public with sharing class FolderController {
    @AuraEnabled
    public static List<Document_Category_Meta__mdt> getFolderMetadata(String recordId) {
        List<Document_Category_Meta__mdt> result = new List<Document_Category_Meta__mdt>();
        String objectName;
        String recordTypeName;
        if (recordId == null) {
            return result;
        }
        
        if (recordId.startsWith('a00')) {
            objectName = 'Project__c';
            result = [SELECT DeveloperName, MasterLabel, Label FROM Document_Category_Meta__mdt WHERE Object_Name__c = :objectName];
        }
        return result;
    }
    
    @AuraEnabled
    public static List<ContentDocumentLink> getFiles(String recordId, String folderLabel) {
        return [
            SELECT ContentDocument.Title, ContentDocumentId, ContentDocument.FileExtension, ContentDocument.ContentSize 
            FROM ContentDocumentLink WHERE LinkedEntityId = :recordId AND ContentDocumentId IN 
            (SELECT ContentDocumentId FROM ContentVersion WHERE FolderIdentifier__c = :folderLabel)
        ];
    }
    
    @AuraEnabled
    public static void associateFileToFolder(String contentDocumentId, String folderLabel) {
        List<ContentVersion> versions = [SELECT Id, FolderIdentifier__c FROM ContentVersion
                                         WHERE ContentDocumentId = :contentDocumentId];
        for(ContentVersion version : versions) {
            version.FolderIdentifier__c = folderLabel;
        }
        update versions;
    }
    
    @AuraEnabled
    public static void deleteFiles(List<Id> contentDocumentIds) {
        List<ContentDocument> documentsToDelete = [SELECT Id FROM ContentDocument WHERE Id IN :contentDocumentIds];
        delete documentsToDelete;
    }


    @AuraEnabled(cacheable=true)
    public static String getFiles1(String recordId, String folderLabel) {
        system.debug('Method getFiles1 started');
        system.debug('recordId=========>' + recordId);
        system.debug('folderLabel=========>' + folderLabel);

        List<ContentDocumentLink> files = [
            SELECT ContentDocument.Title, ContentDocumentId, ContentDocument.FileExtension, ContentDocument.ContentSize
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :recordId
            AND ContentDocumentId IN (SELECT ContentDocumentId FROM ContentVersion WHERE FolderIdentifier__c = :folderLabel)
        ];
        system.debug('files size=========>' + files.size());

        if (files.isEmpty()) {
            system.debug('No files found for the given folder');
            return 'No files found for the given folder';
        }
        
        return 'Success';
    }

}