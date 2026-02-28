public with sharing class TeamLeadDashboardController {
    
  public class SummaryMetrics {
        @AuraEnabled public Integer teamTasksDueToday;
        @AuraEnabled public Integer dueThisWeek;
        @AuraEnabled public Integer overdueTeam;
        @AuraEnabled public Integer s1s2BugsOpen;
    }
 
    @AuraEnabled(cacheable=true)
    public static SummaryMetrics getSummaryMetrics(Id projectId) {
        
        SummaryMetrics result = new SummaryMetrics();
        Date today = Date.today();
        
   
        Date startOfWeek = today.toStartOfWeek();
        Date endOfWeek   = startOfWeek.addDays(6);
        
 
            result.teamTasksDueToday = [
            SELECT COUNT() FROM Tasks__c WHERE End_Date__c = :today AND Status__c NOT IN ('Testing', 'Completed') AND Associated_Project__c = :projectId];
        
 
        result.dueThisWeek = [
            SELECT COUNT()
            FROM Tasks__c WHERE End_Date__c >= :startOfWeek AND End_Date__c <= :endOfWeek AND Status__c NOT IN ('Testing', 'Completed') AND Associated_Project__c = :projectId
        ];
        
        result.overdueTeam = [
            SELECT COUNT() FROM Tasks__c WHERE End_Date__c < :today AND Status__c NOT IN ('Testing', 'Completed') AND Associated_Project__c = :projectId];
        return result;
    }
  }