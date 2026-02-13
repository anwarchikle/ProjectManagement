public class TimeHierarchyRollupService {
    // Simple recursion guard (no underscores to avoid copy/paste unicode issues)
    private static Boolean isRunningFlag = false;
    public  static Boolean isRunning() { return isRunningFlag; }

    
    // Public entry points
    
    public static void rollupFromTaskLists(Set<Id> taskListIds) {
        if (taskListIds == null || taskListIds.isEmpty()) return;

        Boolean startedHere = startGuard();
        try {
            // Task_List__c.Actual_Hours__c = SUM(Tasks__c.Actual_Work_Hours__c)
            Map<Id, Decimal> tlTotals = initZeros(taskListIds);
            for (AggregateResult ar : [
                SELECT Task_List__c tlId, SUM(Actual_Work_Hours__c) sumHrs
                FROM Tasks__c
                WHERE Task_List__c IN :taskListIds
                GROUP BY Task_List__c
            ]) {
                tlTotals.put((Id) ar.get('tlId'), (Decimal) ar.get('sumHrs'));
            }

            List<Task_List__c> tlUpdates = new List<Task_List__c>();
            for (Id tlId : taskListIds) {
                tlUpdates.add(new Task_List__c(
                    Id = tlId,
                    Actual_Hours__c = tlTotals.get(tlId)
                ));
            }
            if (!tlUpdates.isEmpty()) update tlUpdates;

            // Collect impacted Milestones
            Map<Id, Task_List__c> tls = new Map<Id, Task_List__c>([
                SELECT Id, Milestone__c
                FROM Task_List__c
                WHERE Id IN :taskListIds
            ]);
            Set<Id> milestoneIds = new Set<Id>();
            for (Task_List__c tl : tls.values()) {
                if (tl.Milestone__c != null) milestoneIds.add(tl.Milestone__c);
            }
            if (!milestoneIds.isEmpty()) rollupFromMilestones(milestoneIds);
        } finally {
            endGuard(startedHere);
        }
    }

    /**
     * Recompute Milestone__c.Actual_Work_Hours__c from child Task_List__c.Actual_Hours__c.
     * Then cascade to Project__c.
     */
    public static void rollupFromMilestones(Set<Id> milestoneIds) {
        if (milestoneIds == null || milestoneIds.isEmpty()) return;

        Boolean startedHere = startGuard();
        try {
            // Milestone__c.Actual_Work_Hours__c = SUM(Task_List__c.Actual_Hours__c)
            Map<Id, Decimal> msTotals = initZeros(milestoneIds);
            for (AggregateResult ar : [
                SELECT Milestone__c mId, SUM(Actual_Hours__c) sumHrs
                FROM Task_List__c
                WHERE Milestone__c IN :milestoneIds
                GROUP BY Milestone__c
            ]) {
                msTotals.put((Id) ar.get('mId'), (Decimal) ar.get('sumHrs'));
            }

            List<Milestone__c> msUpdates = new List<Milestone__c>();
            for (Id mId : milestoneIds) {
                msUpdates.add(new Milestone__c(
                    Id = mId,
                    Actual_Work_Hours__c = msTotals.get(mId)
                ));
            }
            if (!msUpdates.isEmpty()) update msUpdates;

            // Collect impacted Projects
            Map<Id, Milestone__c> mls = new Map<Id, Milestone__c>([
                SELECT Id, Project__c
                FROM Milestone__c
                WHERE Id IN :milestoneIds
            ]);
            Set<Id> projectIds = new Set<Id>();
            for (Milestone__c m : mls.values()) {
                if (m.Project__c != null) projectIds.add(m.Project__c);
            }
            if (!projectIds.isEmpty()) rollupProjects(projectIds);
        } finally {
            endGuard(startedHere);
        }
    }

    /**
     * Recompute Project__c.Actual_Hours__c from child Milestone__c.Actual_Work_Hours__c.
     */
    public static void rollupProjects(Set<Id> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) return;

        Boolean startedHere = startGuard();
        try {
            // Project__c.Actual_Hours__c = SUM(Milestone__c.Actual_Work_Hours__c)
            Map<Id, Decimal> projTotals = initZeros(projectIds);
            for (AggregateResult ar : [
                SELECT Project__c pId, SUM(Actual_Work_Hours__c) sumHrs
                FROM Milestone__c
                WHERE Project__c IN :projectIds
                GROUP BY Project__c
            ]) {
                projTotals.put((Id) ar.get('pId'), (Decimal) ar.get('sumHrs'));
            }

            List<Project__c> projUpdates = new List<Project__c>();
            for (Id pId : projectIds) {
                projUpdates.add(new Project__c(
                    Id = pId,
                    Actual_Hours__c = projTotals.get(pId)
                ));
            }
            if (!projUpdates.isEmpty()) update projUpdates;
        } finally {
            endGuard(startedHere);
        }
    }

    // -----------------------------
    // Helpers
    // -----------------------------
    private static Map<Id, Decimal> initZeros(Set<Id> ids) {
        Map<Id, Decimal> m = new Map<Id, Decimal>();
        for (Id i : ids) m.put(i, 0);
        return m;
    }

    private static Boolean startGuard() {
        if (!isRunningFlag) {
            isRunningFlag = true;
            return true; // we set it here
        }
        return false; // already running higher up the call stack
    }

    private static void endGuard(Boolean startedHere) {
        if (startedHere) {
            isRunningFlag = false;
        }
    }
}