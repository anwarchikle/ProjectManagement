public with sharing class Mybugscontroller {
    
    /**
     * Get bugs raised by or shared with the current user
     */
    @AuraEnabled(cacheable=true)
    public static List<Issue_Bug__c> getBugs(Id userId) {
        try {
            return [
                SELECT Id, Name, Description__c, 
                       Project__c, Project__r.Name,
                       Release_Milestone__c, Severity__c, Type__c, Status__c, Assignee__r.Name,
                       Expected_Result__c, Actual_Result__c, Environment__c, CreatedDate, LastModifiedDate,
                       CreatedById,
                       (SELECT Id, Name FROM Attachments)
                FROM Issue_Bug__c
                WHERE CreatedById = :userId
                ORDER BY CreatedDate DESC
                LIMIT 1000
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching bugs: ' + e.getMessage());
        }
    }
    
    /**
     * Get metrics for the dashboard
     */
    @AuraEnabled
    public static Map<String, Object> getMetrics(Id userId, String projectFilter, 
                                                  String statusFilter, String severityFilter) {
        try {
            Map<String, Object> metrics = new Map<String, Object>();
            
            // Build dynamic query
            String query = 'SELECT Id, Status__c, Severity__c, CreatedDate ' +
                          'FROM Issue_Bug__c ' +
                          'WHERE CreatedById = :userId';
            
            // Add filters
            if (String.isNotBlank(projectFilter)) {
                query += ' AND Project__r.Name = :projectFilter';
            }
            if (String.isNotBlank(statusFilter)) {
                query += ' AND Status__c = :statusFilter';
            }
            if (String.isNotBlank(severityFilter)) {
                query += ' AND Severity__c = :severityFilter';
            }
            
            List<Issue_Bug__c> bugs = Database.query(query);
            
            // Calculate metrics
            Integer totalRaised = bugs.size();
            Integer openCount = 0;
            Integer criticalBlockerOpen = 0;
            Integer slaBreached = 0;
            Decimal totalAging = 0;
            Integer agingCount = 0;
            
            Set<String> openStatuses = new Set<String>{'New', 'In Progress', 'Assigned', 'Reopened'};
            Set<String> criticalSeverities = new Set<String>{'Critical', 'Blocker'};
            
            for (Issue_Bug__c bug : bugs) {
                // Open count
                if (openStatuses.contains(bug.Status__c)) {
                    openCount++;
                    
                    // Critical/Blocker open
                    if (criticalSeverities.contains(bug.Severity__c)) {
                        criticalBlockerOpen++;
                    }
                    
                    // Average aging calculation
                    if (bug.CreatedDate != null) {
                        Decimal aging = (Decimal)Date.today().daysBetween(bug.CreatedDate.date());
                        totalAging += Math.abs(aging);
                        agingCount++;
                    }
                }
            }
            
            // Calculate average aging
            Decimal avgAging = agingCount > 0 ? totalAging / agingCount : 0;
            
            metrics.put('totalRaised', totalRaised);
            metrics.put('openCount', openCount);
            metrics.put('criticalBlockerOpen', criticalBlockerOpen);
            metrics.put('slaBreached', slaBreached);
            metrics.put('avgAging', avgAging);
            
            return metrics;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error calculating metrics: ' + e.getMessage());
        }
    }
    
    /**
     * Get filter options for dropdowns
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, List<String>> getFilterOptions() {
        try {
            Map<String, List<String>> options = new Map<String, List<String>>();
            
            // Get unique projects
            Set<String> projectSet = new Set<String>();
            for (Issue_Bug__c bug : [SELECT Project__r.Name FROM Issue_Bug__c 
                                      WHERE Project__r.Name != null]) {
                if (bug.Project__r.Name != null) {
                    projectSet.add(bug.Project__r.Name);
                }
            }
            List<String> projects = new List<String>(projectSet);
            projects.sort();
            options.put('projects', projects);
            
            // Get Status picklist values
            List<String> statuses = getPicklistValues('Issue_Bug__c', 'Status__c');
            options.put('statuses', statuses);
            
            // Get Severity picklist values
            List<String> severities = getPicklistValues('Issue_Bug__c', 'Severity__c');
            options.put('severities', severities);
            
            return options;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching filter options: ' + e.getMessage());
        }
    }
    
    /**
     * Helper method to get picklist values
     */
    private static List<String> getPicklistValues(String objectName, String fieldName) {
        List<String> values = new List<String>();
        
        Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectName);
        Schema.DescribeSObjectResult objectDescribe = objectType.getDescribe();
        Schema.DescribeFieldResult fieldDescribe = objectDescribe.fields.getMap().get(fieldName).getDescribe();
        
        for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
            if (entry.isActive()) {
                values.add(entry.getValue());
            }
        }
        
        return values;
    }
}