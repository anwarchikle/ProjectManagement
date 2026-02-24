public with sharing class IssueBugHandler {
	  public static void updateRetestCount(
        List<Issue_Bug__c> newList,
        Map<Id, Issue_Bug__c> oldMap
    ) {

        for (Issue_Bug__c newRec : newList) {

            Issue_Bug__c oldRec = oldMap.get(newRec.Id);

           if (oldRec.Status__c != 'In Retest' &&
                newRec.Status__c == 'In Retest') {

                if (newRec.Retesting_Count__c == null) {
                    newRec.Retesting_Count__c = 1;
                } else {
                    newRec.Retesting_Count__c += 1;
                }
            }
        }
    }
}