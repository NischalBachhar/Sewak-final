import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { listMyBookings } from "@/api/sewak";
import { Booking } from "@/types";
import { colors, radius, spacing } from "@/theme";

export default function BookingsScreen() {
  const [items,setItems]=useState<Booking[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load = useCallback(async () => {
    setError("");
    try { setItems(await listMyBookings()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load bookings."); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  return <Screen>
    <Text style={styles.title}>My bookings</Text>
    <Text style={styles.body}>Care requests, visits and completion status.</Text>
    {loading ? <ActivityIndicator color={colors.accent} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !error && items.length===0 ? <View style={styles.card}><Text style={styles.heading}>No bookings yet</Text><Text style={styles.body}>Your requested care will appear here.</Text></View> : null}
    {items.map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.heading}>{item.caregiverName || "Caregiver"}</Text>
      <Text style={styles.body}>{[item.date,item.time].filter(Boolean).join(" · ") || "Schedule pending"}</Text>
      <Text style={styles.status}>{item.status.replaceAll("_"," ")}</Text>
    </View>)}
  </Screen>;
}
const styles=StyleSheet.create({
  title:{color:colors.text,fontSize:28,fontWeight:"900"},
  heading:{color:colors.text,fontSize:18,fontWeight:"900"},
  body:{color:colors.muted,lineHeight:20},
  status:{color:colors.accent,fontWeight:"900",textTransform:"capitalize"},
  error:{color:colors.danger,fontWeight:"800"},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,gap:8}
});
