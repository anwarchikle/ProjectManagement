public class MilesotoneTriggerHelper {

    public static void updateMilestoneStartDate(List<Milestone__c> newMilestone,Map<Id, Milestone__c> oldMap){
        try{
            for(Milestone__c milestoneRec : newMilestone){
                Milestone__c oldRec = oldMap.get(milestoneRec.Id);
                if(oldRec.Status__c != milestoneRec.Status__c &&
                   milestoneRec.Status__c == 'Completed'){
                    milestoneRec.Actual_End_Date__c = Date.today();
                }
            }
        }catch(Exception e){
            System.debug(' error message =====> ' + e.getMessage() + ' at Line number =====> ' + e.getLineNumber());
        }
    }
}