trigger IssueBug on Issue_Bug__c (before insert,before update) {
	
     if (Trigger.isBefore && Trigger.isUpdate) {
        IssueBugHandler.updateRetestCount(Trigger.new, Trigger.oldMap);
    }
}