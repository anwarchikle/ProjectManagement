trigger Milestone_Rollup on Milestone__c (after insert, after update, after delete, after undelete) {
    if (TimeHierarchyRollupService.isRunning()) return;

    Set<Id> milestoneIds = new Set<Id>();
    Set<Id> projectIds   = new Set<Id>();

    if (Trigger.isInsert || Trigger.isUndelete || Trigger.isUpdate) {
        for (Milestone__c n : Trigger.new) {
            milestoneIds.add(n.Id); // recompute milestone from its TLs
            if (n.Project__c != null) projectIds.add(n.Project__c);
        }
    }
    if (Trigger.isUpdate) {
        for (Integer i = 0; i < Trigger.new.size(); i++) {
            Milestone__c n = Trigger.new[i];
            Milestone__c o = Trigger.old[i];
            if (o.Project__c != n.Project__c && o.Project__c != null) {
                projectIds.add(o.Project__c); // old project also impacted
            }
        }
    }
    if (Trigger.isDelete) {
        for (Milestone__c o : Trigger.old) {
            if (o.Project__c != null) projectIds.add(o.Project__c);
        }
    }

    if (!milestoneIds.isEmpty() || !projectIds.isEmpty()) {
        System.enqueueJob(new TimeHierarchyRollupJob(null, milestoneIds, projectIds));
    }
}