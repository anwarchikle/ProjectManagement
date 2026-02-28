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
                LIMIT 100
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

            // Always calculate metrics for all bugs raised by the user
            List<Issue_Bug__c> bugs = [
                SELECT Id, Status__c, Severity__c, Due_Date__c
                FROM Issue_Bug__c
            ];

            // Calculate metrics
            Integer totalRaised = bugs.size();
            Integer openCount = 0;
            Integer criticalBlockerOpen = 0;
            Decimal totalAging = 0;
            Integer agingCount = 0;

            Set<String> openStatuses = new Set<String>{'New', 'In Progress', 'Assigned', 'Reopened', 'Open'};
            Set<String> criticalSeverities = new Set<String>{'Critical', 'Blocker'};

            for (Issue_Bug__c bug : bugs) {
                // Open count
                if (openStatuses.contains(bug.Status__c)) {
                    openCount++;

                    // Critical/Blocker open
                    if (criticalSeverities.contains(bug.Severity__c)) {
                        criticalBlockerOpen++;
                    }
                }

                // Average aging calculation based on Due Date
                if (bug.Due_Date__c != null) {
                    Decimal aging = (Decimal)Date.today().daysBetween(bug.Due_Date__c);
                    totalAging += Math.abs(aging);
                    agingCount++;
                }
            }

            // Calculate average aging
            Decimal avgAging = agingCount > 0 ? totalAging / agingCount : 0;

            metrics.put('totalRaised', totalRaised);
            metrics.put('openCount', openCount);
            metrics.put('criticalBlockerOpen', criticalBlockerOpen);
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

    @AuraEnabled
    public static Map<String,Integer> uatIssues() {
        try {

            Map<String,Integer> data = new Map<String,Integer>();
            Integer totalBugs = [SELECT Id FROM Issue_Bug__c WHERE Environment__c = 'UAT' AND Status__c != 'Completed'].size();
            Integer openBugs = [SELECT Id FROM Issue_Bug__c WHERE Environment__c = 'UAT' AND Status__c = 'Open'].size();
            Integer criticalBugs = [SELECT Id FROM Issue_Bug__c WHERE Environment__c = 'UAT' AND (Status__c = 'Critical' OR Status__c = 'Blocker')].size();

            data.put('Total', totalBugs);
            data.put('Open', openBugs);
            data.put('Critical', criticalBugs);
            return data;
        } catch (Exception e) {
            System.debug('Error: ' + e.getMessage());
            return null;
        }
    }

    @AuraEnabled
    public static Map<String, Object> getCRMetrics(Id userId, String projectFilter, String decisionFilter) {
        try {
            Map<String, Object> metrics = new Map<String, Object>();

            Boolean hasProject = String.isNotBlank(projectFilter);
            Boolean hasDecision = String.isNotBlank(decisionFilter);

            List<Change_Request__c> crs;

            if (!hasProject && !hasDecision) {
                crs = [
                    SELECT Id, CR_Decision__c, CreatedDate, Project__r.Name
                    FROM Change_Request__c
                ];
            } else if (hasProject && !hasDecision) {
                crs = [
                    SELECT Id, CR_Decision__c, CreatedDate, Project__r.Name
                    FROM Change_Request__c
                    WHERE Project__r.Name = :projectFilter
                ];
            } else if (!hasProject && hasDecision) {
                crs = [
                    SELECT Id, CR_Decision__c, CreatedDate, Project__r.Name
                    FROM Change_Request__c
                    WHERE CR_Decision__c = :decisionFilter
                ];
            } else {
                crs = [
                    SELECT Id, CR_Decision__c, CreatedDate, Project__r.Name
                    FROM Change_Request__c
                    WHERE Project__r.Name = :projectFilter
                    AND   CR_Decision__c = :decisionFilter
                ];
            }

            Integer totalRaised = crs.size();
            Integer onHoldCount = 0;
            Integer acceptedCount = 0;
            Decimal totalAging = 0;
            Integer agingCount = 0;

            for (Change_Request__c cr : crs) {
                if (cr.CR_Decision__c == 'On Hold') {
                    onHoldCount++;
                }
                if (cr.CR_Decision__c == 'Accepted') {
                    acceptedCount++;
                }

                if (cr.CreatedDate != null) {
                    Decimal aging = (Decimal)Date.today().daysBetween(cr.CreatedDate.date());
                    totalAging += Math.abs(aging);
                    agingCount++;
                }
            }

            Decimal avgAging = agingCount > 0 ? totalAging / agingCount : 0;

            metrics.put('totalRaised', totalRaised);
            metrics.put('onHoldCount', onHoldCount);
            metrics.put('acceptedCount', acceptedCount);
            metrics.put('avgAging', avgAging);

            return metrics;
        } catch (Exception e) {
            throw new AuraHandledException('Error calculating Change Request metrics: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, List<String>> getCRFilterOptions() {
        try {
            Map<String, List<String>> options = new Map<String, List<String>>();

            Set<String> projectSet = new Set<String>();
            for (Change_Request__c cr : [SELECT Project__r.Name FROM Change_Request__c WHERE Project__r.Name != null]) {
                if (cr.Project__r.Name != null) {
                    projectSet.add(cr.Project__r.Name);
                }
            }
            List<String> projects = new List<String>(projectSet);
            projects.sort();
            options.put('projects', projects);

            List<String> decisions = getPicklistValues('Change_Request__c', 'CR_Decision__c');
            options.put('decisions', decisions);

            return options;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching Change Request filter options: ' + e.getMessage());
        }
    }

}