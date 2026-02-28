/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : DeveloperDashboardController
 * Author          : <YourName>
 * Created Date    : Feb 26, 2026
 * Last Modified By: <YourName>
 * Last Modified On: Feb 26, 2026
 * Description     : This class implements for......
 *  
 * Change History  :
 *  Date          │   Author     │   Change
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Feb 26, 2026  │ <YourName>   │ Initial version
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */

/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : DeveloperDashboardController
 * Description     : Handles logic for the Developer Dashboard LWC.
 * Filters projects based on Tasks created/active in a specific range.
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */

public with sharing class DeveloperDashboardController {
    
    @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjects(String range) {
        String userId = UserInfo.getUserId();
        Date today = Date.today();
        Date startDate;
        Date endDate = today; 

        if (range == 'Today') {
            startDate = today;
            endDate = today;
        } else if (range == 'This Week') {
            startDate = today.toStartOfWeek();
            endDate = today; 
        } else if (range == 'Last 10 Days') {
            startDate = today.addDays(-10);
            endDate = today;
        } else if (range == 'This Month') {
            startDate = today.toStartOfMonth();
            endDate = today;
        } else if (range == 'Last 60 Days') {
            startDate = today.addDays(-60);
            endDate = today;
        } else {
            startDate = today.addDays(-30);
            endDate = today;
        }

        List<Tasks__c> relevantTasks = [SELECT Associated_Project__c FROM Tasks__c WHERE Id IN (SELECT Tasks__c FROM Task_Owner__c WHERE User__c = :userId) AND CreatedDate >= :startDate AND CreatedDate <= :endDate AND Associated_Project__c != null];

        Set<Id> projectIds = new Set<Id>();
        for(Tasks__c t : relevantTasks) {
            projectIds.add(t.Associated_Project__c);
        }

        if(projectIds.isEmpty()) {
            return new List<Project__c>();
        }

        return [
            SELECT Id, Name 
            FROM Project__c 
            WHERE Id IN :projectIds
            ORDER BY Name ASC
        ];
    }

    public class MyDayWrapper {
        @AuraEnabled public Integer wipCount { get; set; }
        @AuraEnabled public Integer dueTodayCount { get; set; }
        @AuraEnabled public Integer overdueCount { get; set; }
        @AuraEnabled public List<Tasks__c> tasksAssignedToday { get; set; }
        @AuraEnabled public List<Tasks__c> highPriorityQueue { get; set; }
        @AuraEnabled public List<Tasks__c> dueNext7Days { get; set; }
        @AuraEnabled public List<Tasks__c> blockedItems { get; set; }
    }

    @AuraEnabled(cacheable=true)
    public static MyDayWrapper getMyDayData(String range, String projectId) {
        MyDayWrapper result = new MyDayWrapper();
        Id userId = UserInfo.getUserId();
        
        Date today = Date.today();
        Date startDate;
        Date endDate = today; 

        if (range == 'Today') {
            startDate = today;
            endDate = today;
        } else if (range == 'This Week') {
            startDate = today.toStartOfWeek();
            endDate = today; 
        } else if (range == 'Last 10 Days') {
            startDate = today.addDays(-10);
            endDate = today;
        } else if (range == 'This Month') {
            startDate = today.toStartOfMonth();
            endDate = today;
        } else if (range == 'Last 60 Days') {
            startDate = today.addDays(-60);
            endDate = today;
        } else {
            startDate = today.addDays(-30);
            endDate = today;
        }
        Date todayPlus7 = today.addDays(7);

        String baseWhere = ' WHERE Id IN (SELECT Tasks__c FROM Task_Owner__c WHERE User__c = :userId) ' +
                           ' AND CreatedDate >= :startDate AND CreatedDate <= :endDate AND Associated_Project__c != Null ';
        

        String activeStatuses = ' AND Status__c IN (\'Open\', \'Assigned\', \'In Progress\') ';

        result.wipCount      = Database.countQuery('SELECT count() FROM Tasks__c ' + baseWhere + activeStatuses + ' AND End_Date__c >= TODAY');
        result.dueTodayCount = Database.countQuery('SELECT count() FROM Tasks__c ' + baseWhere + activeStatuses + ' AND End_Date__c = TODAY');
        result.overdueCount  = Database.countQuery('SELECT count() FROM Tasks__c ' + baseWhere + activeStatuses + ' AND End_Date__c < TODAY');

        String selectFields = 'SELECT Id, Name, Start_Date__c, End_Date__c, Work_Hours__c, Priority__c, Billing_Type__c, Overdue_Days__c, Associated_Project__r.Name FROM Tasks__c ';
        
        result.tasksAssignedToday = Database.query(selectFields + baseWhere + ' AND Start_Date__c = TODAY ORDER BY CreatedDate DESC LIMIT 5');
        
        result.highPriorityQueue = Database.query(selectFields + baseWhere + ' AND Priority__c = \'High\' ORDER BY CreatedDate DESC LIMIT 5');
        
        result.dueNext7Days = Database.query(selectFields + baseWhere + ' AND End_Date__c >= TODAY AND End_Date__c <= :todayPlus7 ORDER BY End_Date__c ASC LIMIT 5');
        
        result.blockedItems = Database.query(selectFields + baseWhere + ' AND Overdue_Days__c > 0 ORDER BY Overdue_Days__c DESC LIMIT 5');

        return result;
    }
}