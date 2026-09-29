import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { getCaregiver } from "@/api/sewak";
import { useAuth } from "@/auth/AuthProvider";
import { Caregiver } from "@/types";
import { colors, radius, spacing } from "@/theme";

export default function CaregiverProfileScreen() {
  const {id}=useLocalSearchParams<{id:string}>();
  const router=useRouter();
  const {user,role}=useAuth();
  const [caregiver,setCaregiver]=useState<Caregiver|null>(null);
  const [error,setError]=useState("");

  useEffect(()=>{ if(id)getCaregiver(id).then(setCaregiver).catch(err=>setError(err instanceof Error?err.message:"Unable to load caregiver.")); },[id]);

  if(!caregiver&&!error)return <View style={styles.center}><ActivityIndicator color={colors.accent}/></View>;
  if(error||!caregiver)return <Screen><Text style={styles.error}>{error||"Caregiver not found."}</Text></Screen>;

  return <Screen>
    <View style={styles.hero}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{caregiver.name.slice(0,1).toUpperCase()}</Text></View>
      <Text style={styles.name}>{caregiver.name}</Text>
      <Text style={styles.body}>{caregiver.location || "Location not listed"}{caregiver.experience!=null?` · ${caregiver.experience} years experience`:""}</Text>
      {caregiver.rating?<Text style={styles.rating}>★ {caregiver.rating.toFixed(1)}{caregiver.reviewCount?` (${caregiver.reviewCount} reviews)`:""}</Text>:null}
    </View>

    <View style={styles.card}><Text style={styles.heading}>About</Text><Text style={styles.body}>{caregiver.bio || "Caregiver profile information will appear here."}</Text></View>
    <View style={styles.card}><Text style={styles.heading}>Care services</Text><Text style={styles.body}>{(caregiver.serviceLabels || caregiver.servicesOffered || []).join(" · ") || "Care support"}</Text></View>
    <View style={styles.card}><Text style={styles.heading}>Rate</Text><Text style={styles.rate}>{caregiver.hourlyRate!=null?`NPR ${caregiver.hourlyRate.toLocaleString("en-NP")} / hour`:"Rate on request"}</Text></View>

    {role==="user" ? <PrimaryButton label="Request care" onPress={()=>router.push({pathname:"/booking/[caregiverId]",params:{caregiverId:caregiver.id}})} /> : !user ? <PrimaryButton label="Sign in to request care" onPress={()=>router.push("/sign-in")} /> : null}
  </Screen>;
}
const styles=StyleSheet.create({
  center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.background},
  hero:{alignItems:"center",gap:8,paddingVertical:spacing.md},
  avatar:{width:82,height:82,borderRadius:41,backgroundColor:colors.accentLight,alignItems:"center",justifyContent:"center"},
  avatarText:{color:colors.accentStrong,fontSize:34,fontWeight:"900"},
  name:{color:colors.text,fontSize:26,fontWeight:"900"},
  body:{color:colors.muted,lineHeight:21,textAlign:"center"},
  rating:{color:colors.warning,fontWeight:"900"},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:spacing.sm},
  heading:{color:colors.text,fontSize:18,fontWeight:"900"},
  rate:{color:colors.accent,fontSize:18,fontWeight:"900"},
  error:{color:colors.danger,fontWeight:"800"}
});
