/**
* ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
* Class Name      : workSpaceController
* Author          : Md Anwar Chikle
* Created Date    : Jan 25, 2026
* Last Modified By: <YourName>
* Last Modified On: Jan 25, 2026
* Description     : This class implements for......
*  
* Change History  :
*  Date          │   Author     │   Change
* ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
*  Jan 25, 2026  │ Md Anwar Chikle  │ Initial version
* ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
*/
public with sharing class workSpaceController {
    
    @AuraEnabled
    public static List<Project__c> getProjectsAndReleatedRecrods(){
        try {
            List<Project__c> listOfProjects = [
                SELECT
                Id,
                Name,
                Status__c,
                Start_Date__c,
                End_Date__c,
                Planned_Hours__c,
                Actual_Hours__c,
                (
                    SELECT
                    Id,
                    Name,
                    Status__c,
                    Start_Date__c,
                    End_Date__c,
                    Planned_Hours__c,
                    Actual_Work_Hours__c,
                    (
                        SELECT
                        Id,
                        Name,
                        Planned_Hours__c,
                        Actual_Hours__c,
                        Start_Date__c,
                        End_Date__c,
                        (
                            SELECT
                            Id,
                            Name,
                            Status__c,
                            Start_Date__c,
                            End_Date__c,
                            Work_Hours__c,
                            //Actual_Work_Hours__c
                            Logged_Hours__c
                            FROM Tasks__r where Is_Active__c = true Order By CreatedDate DESC
                        )
                        FROM Task_Lists__r where Is_Active__c = true Order By CreatedDate DESC
                    )
                    FROM Milestones__r where Is_Active__c = true Order By CreatedDate DESC
                )
                FROM Project__c where Is_Active__c = true Order By CreatedDate DESC
            ];
            
            return listOfProjects;
        } catch (Exception e) {
            System.debug(' error message ====>' + e.getMessage() + ' at line number ====>' + e.getLineNumber());
            return null;
        }
    }
    
    @AuraEnabled
    public static void deleteContactOrCase(String recordId, String objectName){
        System.debug(recordId+' '+objectName);
        if(objectName=='Contact') {
            List<Contact> con = [SELECT Id, Name FROM Contact WHERE Id =: recordId];
            try {
                System.debug('Contact => '+ con);
                delete con;
            } catch (DmlException e) {
                throw new AuraHandledException(e.getMessage());
            }
        }
        else if(objectName=='Case') {
            List<Case> cas = [SELECT Id, Subject FROM Case WHERE Id =: recordId];
            try {
                System.debug('Case => '+ cas);
                delete cas;
            } catch (DmlException e) {
                throw new AuraHandledException(e.getMessage());
            }
        } else {
            
        }
    }

    @AuraEnabled
    public static string getRecordDetails(Id recordId) {
        try {
            if (recordId == null) return null;

            String objectName = recordId.getSObjectType().getDescribe().getName();
            System.debug('objectName ====> ' + objectName);

            if (objectName == 'Milestone__c') {
                Milestone__c ms = [SELECT Project__c FROM Milestone__c WHERE Id = :recordId LIMIT 1];
                System.debug('ms.Project__c ====> ' + ms.Project__c);
                return ms.Project__c;
            }
            return null;
        } catch (Exception e) {
            System.debug('Error ====> ' + e.getMessage() + ' | Line ====> ' + e.getLineNumber());
            return e.getMessage();
        }
    }



    /**
    * @description: Check if the current user is an internal Salesforce user or an Experience Site user
    * @return: Boolean - true if internal user, false if site/community user
    */
    @AuraEnabled(cacheable=true)
    public static Boolean isInternalUser() {
        try {
            // Check if user is in a Community/Experience Site
            // Network.getNetworkId() returns null for internal users
            // Returns a NetworkId for Experience Site/Community users
            Id networkId = Network.getNetworkId();
            
            // If networkId is null, user is an internal Salesforce user
            return networkId == null;
            
        } catch (Exception e) {
            System.debug('Error checking user type: ' + e.getMessage());
            // Default to false (treat as site user) if error occurs
            return false;
        }
    }

    /**
    * @description: Get detailed user context information (Optional - for debugging)
    * @return: Map containing user type details
    */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getUserContext() {
        try {
            Id networkId = Network.getNetworkId();
            User currentUser = [SELECT UserType, ProfileId, Profile.Name 
                               FROM User 
                               WHERE Id = :UserInfo.getUserId() 
                               LIMIT 1];
            
            return new Map<String, Object>{
                'isInternal' => networkId == null,
                'userType' => currentUser.UserType,
                'profileName' => currentUser.Profile.Name,
                'networkId' => networkId,
                'userId' => UserInfo.getUserId()
            };
        } catch (Exception e) {
            System.debug('Error getting user context: ' + e.getMessage());
            return new Map<String, Object>{
                'error' => e.getMessage()
            };
        }
    }
}