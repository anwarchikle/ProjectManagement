/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : projectStatusController
 * Author          : Anwar Chikle
 * Created Date    : Jan 28, 2026
 * Last Modified By: Anwar Chikle
 * Last Modified On: Jan 28, 2026
 * Description     : Controller to fetch Project with related Milestones,
 *                   Task Lists, and Tasks for status & timeline views.
 *  
 * Change History  :
 *  Date          │   Author        │   Change
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Jan 28, 2026  │ Anwar Chikle    │ Initial version
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */

public with sharing class projectStatusController {
    @AuraEnabled(cacheable=true)
    public static Project__c getProjectData(Id recordId) {
        if (recordId == null) {
            return null;
        }
        try {
            // Calculate this week's date range (Sunday to Saturday)
            Date today = Date.today();
            Date weekStart = today.toStartOfWeek(); // Sunday
            Date weekEnd = weekStart.addDays(6);    // Saturday
            
            return [
                SELECT Id, Name, Status__c, Start_Date__c, End_Date__c, Planned_Hours__c, 
                       Customer__c, Customer__r.Name,
                    (SELECT Id, Name, Status__c, Start_Date__c, End_Date__c, Planned_Hours__c,
                        (SELECT Id, Name, Planned_Hours__c, Actual_Hours__c,
                            (SELECT Id, Name, Status__c, Priority__c, End_Date__c, 
                                    Completion_Percentage__c, Assigned_To__c, Assigned_To__r.Name,
                                    (SELECT Id, Name, User__c, User__r.Name 
                                     FROM Task_Owners__r)
                             FROM Tasks__r
                             WHERE End_Date__c >= :weekStart 
                             AND End_Date__c <= :weekEnd)
                         FROM Task_Lists__r) 
                     FROM Milestones__r)
                FROM Project__c 
                WHERE Id = :recordId 
                LIMIT 1
            ];
        } catch (Exception e) {
            System.debug('Error in =====> ' + e.getMessage() + ' at Line number =====> ' + e.getLineNumber());
            return null;
        }
    }
}