// Commented by Harsh: Removed Issue_Bug__c dependency
public with sharing class TimeLogHelper {   
    // Get daily capacity from custom label
    private static Decimal getDailyCapacity() {
        try {
            String capacityStr = System.Label.User_Daily_Capacity;
            if (String.isNotBlank(capacityStr)) {
                return Decimal.valueOf(capacityStr);
            }
        } catch (Exception e) {
            System.debug('Error parsing label: ' + e.getMessage());
        }
        return 16; // Default value
    }
    
    @AuraEnabled(cacheable=true)
    public static Tasks__c getTaskWithProject(Id taskId) {
        if (taskId == null) return null;
        
        return [ SELECT Id, Associated_Project__c FROM Tasks__c WHERE Id = :taskId LIMIT 1];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjects() {
        return [SELECT Id, Name FROM Project__c ORDER BY Name LIMIT 200];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Tasks__c> getTasksByProject(Id projectId) {
        if (projectId == null) {
            return new List<Tasks__c>();
        }
        return [SELECT Id, Name, Associated_Project__c 
                FROM Tasks__c 
                WHERE Associated_Project__c = :projectId AND Status__c NOT IN ('Testing', 'Completed')
                ORDER BY Name 
                LIMIT 200];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<String> getBillablePicklistValues() {
        Schema.DescribeFieldResult fieldDescribe = Time_Log__c.Billable_Type__c.getDescribe();
        List<Schema.PicklistEntry> picklistValues = fieldDescribe.getPicklistValues();
        List<String> options = new List<String>();
        for (Schema.PicklistEntry entry : picklistValues) {
            options.add(entry.getValue());
        }
        return options;
    }
    
    /* Commented by Harsh: Issue_Bug__c picklist access removed as field/relationship is being deleted.
    @AuraEnabled(cacheable=true)
    public static List<String> getIssueBugPicklistValues() {
        Schema.DescribeFieldResult fieldDescribe = Time_Log__c.Issue_Bug__c.getDescribe();
        List<Schema.PicklistEntry> picklistValues = fieldDescribe.getPicklistValues();
        List<String> options = new List<String>();
        for (Schema.PicklistEntry entry : picklistValues) {
            options.add(entry.getValue());
        }
        return options;
    }
    */
    
    @AuraEnabled(cacheable=true)
    public static String getUserName(Id userId) {
        User u = [SELECT Name FROM User WHERE Id = :userId LIMIT 1];
        return u.Name;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<User> getActiveUsers() {
        return [SELECT Id, Name FROM User WHERE IsActive = true ORDER BY Name LIMIT 200];
    }
    
    @AuraEnabled(cacheable=true)
    public static Decimal getDailyCapacityValue() {
        return getDailyCapacity();
    }
    
    @AuraEnabled(cacheable=true)
    public static Decimal getTotalHoursForUserOnDate(Id userId, Date logDate) {
        AggregateResult[] groupedResults = [
            SELECT SUM(Daily_Logs__c) totalHours
            FROM Time_Log__c
            WHERE User__c = :userId 
            AND Date__c = :logDate
        ];
        
        if (groupedResults.size() > 0 && groupedResults[0].get('totalHours') != null) {
            return (Decimal) groupedResults[0].get('totalHours');
        }
        return 0;
    }
    @AuraEnabled
    public static Time_Log__c createTimeLog(Time_Log__c timeLog) {
        Decimal dailyCapacity = getDailyCapacity();
        
        // Basic Validation
        if (timeLog.Projects__c == null) throw new AuraHandledException('Project is required');
        if (timeLog.Tasks__c == null) throw new AuraHandledException('Task is required');
        if (timeLog.User__c == null) throw new AuraHandledException('User is required');
        if (timeLog.Date__c == null) throw new AuraHandledException('Date is required');
        if (timeLog.Daily_Logs__c == null || timeLog.Daily_Logs__c <= 0) throw new AuraHandledException('Hours must be > 0');
        if (timeLog.Daily_Logs__c > dailyCapacity) throw new AuraHandledException('Max ' + dailyCapacity + ' hrs per entry');
        
        // Check total hours for the user on this date
        Decimal totalHoursOnDate = getTotalHoursForUserOnDate(timeLog.User__c, timeLog.Date__c);
        Decimal newTotalHours = totalHoursOnDate + timeLog.Daily_Logs__c;
        
        if (newTotalHours > dailyCapacity) {
            Decimal remainingHours = dailyCapacity - totalHoursOnDate;
            throw new AuraHandledException('Daily limit ' + dailyCapacity + 'hrs. Already logged ' + totalHoursOnDate + 'hrs. Remaining: ' + remainingHours + 'hrs');
        }
        
        try {
            insert timeLog;
            return timeLog;
        } catch (DmlException e) {
            throw new AuraHandledException('Save failed: ' + e.getMessage());
        }
    }
    
    
    @AuraEnabled
    public static List<Time_Log__c> createWeeklyTimeLogs(List<Time_Log__c> timeLogs) {
        
        try {
            
            System.debug('Received time logs: ' + timeLogs);
            
            if (timeLogs == null || timeLogs.isEmpty()) {
                throw new AuraHandledException('No time logs provided');
            }
            
            // Get configured daily capacity
            Decimal dailyCapacity = getDailyCapacity();
            
            // -------------------------------
            // 1. Basic Field Validation
            // -------------------------------
            for (Time_Log__c log : timeLogs) {
                
                if (log.Projects__c == null) {
                    throw new AuraHandledException('Project is required for all time logs');
                }
                
                if (log.User__c == null) {
                    throw new AuraHandledException('User is required for all time logs');
                }
                
                if (log.Date__c == null) {
                    throw new AuraHandledException('Date is required for all time logs');
                }
                
                if (log.Daily_Logs__c == null || log.Daily_Logs__c <= 0) {
                    throw new AuraHandledException('Hours must be greater than 0');
                }
                
                if (log.Daily_Logs__c > dailyCapacity) {
                    throw new AuraHandledException('Max ' + dailyCapacity + ' hrs per entry');
                }
            }
            
            // -------------------------------
            // 2. Collect Users & Dates
            // -------------------------------
            Set<Id> userIds = new Set<Id>();
            Set<Date> allDates = new Set<Date>();
            
            for (Time_Log__c log : timeLogs) {
                userIds.add(log.User__c);
                allDates.add(log.Date__c);
            }
            
            // -------------------------------
            // 3. Fetch Existing Totals
            // -------------------------------
            Map<Id, Map<Date, Decimal>> existingTotals = new Map<Id, Map<Date, Decimal>>();
            
            if (!userIds.isEmpty() && !allDates.isEmpty()) {
                
                for (AggregateResult ar : [
                    SELECT User__c userId, Date__c logDate, SUM(Daily_Logs__c) totalHours
                    FROM Time_Log__c
                    WHERE User__c IN :userIds
                    AND Date__c IN :allDates
                    GROUP BY User__c, Date__c
                ]) {
                    
                    Id uId = (Id) ar.get('userId');
                    Date d = (Date) ar.get('logDate');
                    Decimal hrs = (Decimal) ar.get('totalHours');
                    
                    if (!existingTotals.containsKey(uId)) {
                        existingTotals.put(uId, new Map<Date, Decimal>());
                    }
                    
                    existingTotals.get(uId).put(d, hrs);
                }
            }
            
            // -------------------------------
            // 4. Validate Combined Totals
            // -------------------------------
            Map<Id, Map<Date, Decimal>> newTotals = new Map<Id, Map<Date, Decimal>>();
            
            for (Time_Log__c log : timeLogs) {
                
                Id uId = log.User__c;
                Date d = log.Date__c;
                Decimal hrs = log.Daily_Logs__c;
                
                if (!newTotals.containsKey(uId)) {
                    newTotals.put(uId, new Map<Date, Decimal>());
                }
                
                Decimal baseExisting = 0;
                if (existingTotals.containsKey(uId) && existingTotals.get(uId).containsKey(d)) {
                    baseExisting = existingTotals.get(uId).get(d);
                }
                
                Decimal currentNewTotal = newTotals.get(uId).containsKey(d)
                    ? newTotals.get(uId).get(d)
                    : 0;
                
                Decimal combined = baseExisting + currentNewTotal + hrs;
                
                if (combined > dailyCapacity) {
                    
                    Decimal remaining = dailyCapacity - (baseExisting + currentNewTotal);
                    
                    throw new AuraHandledException(
                        'Daily limit ' + dailyCapacity + 'hrs. Already logged ' + baseExisting + 'hrs. ' +
                        'Remaining (including current batch): ' + remaining + 'hrs for user on ' + String.valueOf(d)
                    );
                }
                
                newTotals.get(uId).put(d, currentNewTotal + hrs);
            }
            
            // -------------------------------
            // 5. Insert Records
            // -------------------------------
            insert timeLogs;
            
            System.debug('Successfully inserted ' + timeLogs.size() + ' time logs');
            
            return timeLogs;
            
        } catch (Exception e) {
            
            System.debug('Error in createWeeklyTimeLogs: ' + e.getMessage());
            
            // Preserve original AuraHandledException messages
            if (e instanceof AuraHandledException) {
                throw (AuraHandledException) e;
            }
            
            // Wrap unexpected exceptions
            throw new AuraHandledException('Failed to create time logs: ' + e.getMessage());
        }
    }
    
}