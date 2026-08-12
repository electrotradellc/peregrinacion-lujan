"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateConfig(eventId: string) {
  revalidatePath(`/admin/eventos/${eventId}/config`);
  revalidatePath("/admin/eventos");
}

export async function updateEventSettingsAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      name: String(formData.get("name")),
      event_date: String(formData.get("event_date")),
      registration_price_ars: Number(formData.get("registration_price_ars")),
      status: String(formData.get("status")),
      pending_payment_expiry_days: Number(formData.get("pending_payment_expiry_days")),
      whatsapp_group_invite_url: String(formData.get("whatsapp_group_invite_url") || "") || null,
      payment_alias: String(formData.get("payment_alias") || "") || null,
      contact_email: String(formData.get("contact_email") || "") || null,
      captains_coordinator_name: String(formData.get("captains_coordinator_name") || "") || null,
      captains_coordinator_whatsapp: String(formData.get("captains_coordinator_whatsapp") || "") || null,
      payment_instructions: String(formData.get("payment_instructions") || ""),
      walking_recommendations: String(formData.get("walking_recommendations") || ""),
      terms_and_conditions: String(formData.get("terms_and_conditions") || ""),
      terms_version: String(formData.get("terms_version") || "1"),
    })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidateConfig(eventId);
}

export async function addStartingPointAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("starting_points").insert({
    event_id: eventId,
    name: String(formData.get("name")),
    presentation_time: String(formData.get("presentation_time")),
    presentation_location: String(formData.get("presentation_location")),
  });
  if (error) throw new Error(error.message);
  revalidateConfig(eventId);
}

export async function deleteStartingPointAction(eventId: string, startingPointId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("starting_points").delete().eq("id", startingPointId);
  if (error) throw new Error(error.message);
  revalidateConfig(eventId);
}

export async function addBusAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("buses").insert({
    event_id: eventId,
    starting_point_id: String(formData.get("starting_point_id")),
    bus_number: Number(formData.get("bus_number")),
    capacity: Number(formData.get("capacity")),
  });
  if (error) throw new Error(error.message);
  revalidateConfig(eventId);
}

export async function deleteBusAction(eventId: string, busId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("buses").delete().eq("id", busId);
  if (error) throw new Error(error.message);
  revalidateConfig(eventId);
}

export async function addStopAction(eventId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("stops").insert({
    event_id: eventId,
    sequence_order: Number(formData.get("sequence_order")),
    name: String(formData.get("name")),
    location_description: String(formData.get("location_description") || "") || null,
    maps_url: String(formData.get("maps_url") || "") || null,
    expected_time: String(formData.get("expected_time") || "") || null,
    is_presentation_stop: formData.get("is_presentation_stop") === "on",
  });
  if (error) throw new Error(error.message);
  revalidateConfig(eventId);
}

export async function updateStopAction(eventId: string, stopId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stops")
    .update({
      sequence_order: Number(formData.get("sequence_order")),
      name: String(formData.get("name")),
      location_description: String(formData.get("location_description") || "") || null,
      maps_url: String(formData.get("maps_url") || "") || null,
      expected_time: String(formData.get("expected_time") || "") || null,
      is_presentation_stop: formData.get("is_presentation_stop") === "on",
    })
    .eq("id", stopId);
  if (error) throw new Error(error.message);
  revalidateConfig(eventId);
}

export async function deleteStopAction(eventId: string, stopId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stops").delete().eq("id", stopId);
  if (error) throw new Error(error.message);
  revalidateConfig(eventId);
}
