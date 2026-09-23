import React, { useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { createBooking } from "@/api/sewak";
import { usingMockData } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing } from "@/theme";

export default function BookingScreen() {
  const {caregiverId}=useLocalSearchParams<{caregiverId:string}>();
  const router=useRouter();
  const {user,role,profile}=useAuth();

  const [recipient,setRecipient]=useState("");
  const [needs,setNeeds]=useState("");
  const [date,setDate]=useState("");
  const [time,setTime]=useState("");
  const [phone,setPhone]=useState(profile?.phone || "");
  const [address,setAddress]=useState("");
  const [city,setCity]=useState("");
  const [error,setError]=useState("");
  const [done,setDone]=useState("");

  if(!user)return <Redirect href="/sign-in"/>;
  if(role!=="user")return <Redirect href="/(tabs)/home"/>;

  const submit=async()=>{
    if(!recipient.trim()||!needs.trim()||!date||!time||!phone.trim()||!address.trim()||!city.trim()){
      setError("Complete all required fields.");
      return;
    }
    try{
      setError("");
      const result=await createBooking({
        caregiverId,
        careRecipient:recipient.trim(),
        careNeeds:needs.trim(),
        date,
        time,
        durationHours:4,
        recurrence:"one_time",
        fullName:profile?.name || user.displayName || "",
        phone:phone.trim(),
        address:address.trim(),
        city:city.trim()
      });
      setDone(result.id);
    }catch(err){
      setError(err instanceof Error?err.message:"Unable to create booking.");
    }
  };

  if(done)return <Screen><View style={styles.card}><Text style={styles.title}>Care request sent</Text><Text style={styles.body}>{usingMockData?"Created in development mode only; nothing was written to production.":"You can follow the status in My bookings."}</Text><Text style={styles.body}>Reference: {done}</Text><PrimaryButton label="Go to My bookings" onPress={()=>router.replace("/(tabs)/bookings")}/></View></Screen>;

  const fields:[string,string,(v:string)=>void][]=[
    ["Who needs care?",recipient,setRecipient],
    ["What support is needed?",needs,setNeeds],
    ["Date (YYYY-MM-DD)",date,setDate],
    ["Start time (HH:MM)",time,setTime],
    ["Phone",phone,setPhone],
    ["Address",address,setAddress],
    ["City",city,setCity]
  ];

  return <Screen>
    <Text style={styles.title}>Request care</Text>
    <Text style={styles.body}>This is the mobile booking foundation. Authoritative pricing, commission and eligibility remain backend responsibilities.</Text>
    <View style={styles.card}>
      {fields.map(([label,value,setter])=><View key={label} style={{gap:6}}><Text style={styles.label}>{label} *</Text><TextInput value={value} onChangeText={setter} style={styles.input}/></View>)}
      {error?<Text style={styles.error}>{error}</Text>:null}
      <PrimaryButton label="Send care request" onPress={submit}/>
    </View>
  </Screen>;
}
const styles=StyleSheet.create({
  title:{color:colors.text,fontSize:28,fontWeight:"900"},
  body:{color:colors.muted,lineHeight:21},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,gap:spacing.md},
  label:{color:colors.textSecondary,fontWeight:"800",fontSize:13},
  input:{minHeight:48,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:12,backgroundColor:colors.surfaceAlt,color:colors.text},
  error:{color:colors.danger,fontWeight:"800"}
});
