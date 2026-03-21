CREATE TYPE "public"."anomaly_status" AS ENUM('open', 'resolved', 'validated', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."anomaly_type" AS ENUM('km_invalid', 'time_invalid', 'duration_mismatch', 'no_departure', 'overlap', 'location_mismatch', 'km_regression', 'km_implausible', 'duration_implausible', 'missing_required', 'late_entry');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'self_assigned', 'pending', 'confirmed', 'declined', 'swapped', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'consent_granted', 'consent_revoked', 'data_export_requested', 'data_erasure_requested', 'password_change', 'role_change', 'vehicle_access', 'trip_submit', 'checklist_submit', 'chat_message');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'vehicle', 'system', 'admin');--> statement-breakpoint
CREATE TYPE "public"."backup_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'verified', 'expired');--> statement-breakpoint
CREATE TYPE "public"."backup_type" AS ENUM('full', 'incremental', 'differential', 'snapshot');--> statement-breakpoint
CREATE TYPE "public"."burnout_risk_level" AS ENUM('low', 'moderate', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('granted', 'revoked', 'pending', 'expired');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('privacy_policy', 'terms_of_service', 'data_processing', 'marketing_communications', 'analytics_tracking', 'location_tracking');--> statement-breakpoint
CREATE TYPE "public"."demo_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."device_authorizer_type" AS ENUM('medico_bordo', 'infermiere_bordo', 'medico_reparto', 'centrale_operativa');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('libretto', 'assicurazione', 'revisione', 'bollo', 'autorizzazione_sanitaria', 'altro');--> statement-breakpoint
CREATE TYPE "public"."gdpr_request_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."gdpr_request_type" AS ENUM('data_export', 'data_erasure', 'data_rectification', 'processing_restriction');--> statement-breakpoint
CREATE TYPE "public"."handoff_status" AS ENUM('pending', 'read', 'archived');--> statement-breakpoint
CREATE TYPE "public"."health_check_status" AS ENUM('healthy', 'degraded', 'unhealthy', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."hub_booking_status" AS ENUM('pending', 'confirmed', 'assigned', 'in_transit', 'patient_aboard', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."hub_client_type" AS ENUM('private', 'facility');--> statement-breakpoint
CREATE TYPE "public"."hub_convention_status" AS ENUM('pending', 'active', 'expired', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."integrity_status" AS ENUM('VALID', 'BROKEN', 'NOT_SIGNED');--> statement-breakpoint
CREATE TYPE "public"."inventory_category" AS ENUM('presidi', 'farmaci', 'medicazione', 'rianimazione', 'immobilizzazione', 'protezione', 'fluidi', 'strumentazione', 'altro');--> statement-breakpoint
CREATE TYPE "public"."inventory_status" AS ENUM('disponibile', 'in_uso', 'scaduto', 'danneggiato', 'da_ordinare');--> statement-breakpoint
CREATE TYPE "public"."monitored_entity" AS ENUM('trip', 'vehicle', 'user', 'structure', 'location');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('active', 'trial', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."partner_category" AS ENUM('ristorazione', 'commercio', 'servizi', 'salute', 'tempo_libero', 'viaggi', 'auto', 'casa', 'tecnologia', 'formazione', 'altro');--> statement-breakpoint
CREATE TYPE "public"."partner_status" AS ENUM('pending', 'approved', 'rejected', 'suspended', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."partner_tier" AS ENUM('bronze', 'silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "public"."reimbursement_status" AS ENUM('draft', 'pending_signature', 'signed', 'approved', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rescue_sheet_dispatch_code" AS ENUM('C', 'B', 'V', 'G', 'R');--> statement-breakpoint
CREATE TYPE "public"."rescue_sheet_mission_code" AS ENUM('0', '1', '2', '3', '4');--> statement-breakpoint
CREATE TYPE "public"."sanitization_type" AS ENUM('ordinaria', 'straordinaria', 'infettivo');--> statement-breakpoint
CREATE TYPE "public"."service_assignment_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."service_event_type" AS ENUM('sporting_event', 'cultural_event', 'medical_support', 'emergency_cover', 'training', 'meeting', 'other');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('dimissione', 'visita', 'trasferimento', 'dialisi', 'coronarografia', 'radioterapia', 'chemioterapia', 'riabilitazione', 'day_hospital', 'altro');--> statement-breakpoint
CREATE TYPE "public"."shift_role" AS ENUM('autista', 'soccorritore', 'infermiere', 'medico', 'coordinatore');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('draft', 'open', 'published', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."signature_status" AS ENUM('draft', 'sent', 'viewed', 'volunteer_signed', 'org_signed', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sla_metric_type" AS ENUM('uptime', 'response_time', 'error_rate', 'throughput', 'availability');--> statement-breakpoint
CREATE TYPE "public"."staff_milestone_type" AS ENUM('turni_100', 'turni_500', 'anniversario_1', 'anniversario_5', 'primo_scambio', 'aiuto_collega');--> statement-breakpoint
CREATE TYPE "public"."staff_role_key" AS ENUM('autista', 'soccorritore', 'infermiere', 'medico', 'coordinatore');--> statement-breakpoint
CREATE TYPE "public"."staff_wellness_state" AS ENUM('stanco', 'ok', 'carico');--> statement-breakpoint
CREATE TYPE "public"."structure_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."swap_request_status" AS ENUM('pending', 'accepted', 'rejected', 'approved', 'denied', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('MSB', 'MSI', 'EVENT');--> statement-breakpoint
CREATE TYPE "public"."timeliness_status" AS ENUM('realtime', 'timely', 'delayed', 'late');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('MSB', 'MSI');--> statement-breakpoint
CREATE TYPE "public"."volunteer_status" AS ENUM('active', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."volunteer_type" AS ENUM('continuativo', 'occasionale');--> statement-breakpoint
CREATE TABLE "active_tracking_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"trip_id" varchar,
	"user_id" varchar NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_update_at" timestamp DEFAULT now() NOT NULL,
	"points_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "active_tracking_sessions_vehicle_id_unique" UNIQUE("vehicle_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_reads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"created_by_id" varchar NOT NULL,
	"created_by_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_hash_chain_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_entry_id" varchar NOT NULL,
	"end_entry_id" varchar NOT NULL,
	"entries_count" integer NOT NULL,
	"is_valid" boolean NOT NULL,
	"root_hash" text NOT NULL,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"verified_by" varchar,
	"verification_method" text DEFAULT 'sha256_chain',
	"issues" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" varchar,
	"actor_name" text,
	"actor_email" text,
	"session_id" varchar,
	"ip_address" text,
	"user_agent" text,
	"device_info" text,
	"location_id" varchar,
	"location_name" text,
	"vehicle_id" varchar,
	"vehicle_code" text,
	"action" "audit_action" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"entity_name" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"changed_fields" jsonb,
	"description" text,
	"metadata" jsonb,
	"entry_hash" text NOT NULL,
	"previous_hash" text,
	"is_sensitive" boolean DEFAULT false,
	"is_compliance" boolean DEFAULT false,
	"retention_years" integer DEFAULT 10,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"user_id" varchar,
	"user_name" text,
	"changes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_retention_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"entity_type" text,
	"action_type" text,
	"retention_years" integer DEFAULT 10 NOT NULL,
	"archive_after_years" integer DEFAULT 5,
	"legal_basis" text,
	"regulatory_requirement" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_name" text NOT NULL,
	"backup_type" "backup_type" NOT NULL,
	"schedule_type" text NOT NULL,
	"schedule_cron" text,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"retention_copies" integer DEFAULT 7,
	"is_encrypted" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barcode_product_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barcode" text NOT NULL,
	"source" text NOT NULL,
	"product_name" text,
	"description" text,
	"brand" text,
	"manufacturer" text,
	"quantity_per_package" integer,
	"package_size" text,
	"default_unit" text,
	"category" text,
	"image_url" text,
	"has_expiry" boolean DEFAULT false,
	"default_expiry_days" integer,
	"ingredients" text,
	"raw_payload" jsonb,
	"is_verified" boolean DEFAULT false,
	"lookup_count" integer DEFAULT 1,
	"last_lookup_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "barcode_product_cache_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "benchmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_date" date NOT NULL,
	"metric_type" text NOT NULL,
	"avg_value" real,
	"median_value" real,
	"p25_value" real,
	"p75_value" real,
	"min_value" real,
	"max_value" real,
	"sample_size" integer,
	"region" text,
	"org_size_category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "burnout_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"alert_type" text NOT NULL,
	"risk_level" "burnout_risk_level" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"triggered_value" real,
	"threshold_value" real,
	"period_start" date,
	"period_end" date,
	"is_read" boolean DEFAULT false,
	"is_resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"resolution_notes" text,
	"suggested_actions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "burnout_thresholds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"max_hours_per_day" real DEFAULT 10 NOT NULL,
	"max_hours_per_week" real DEFAULT 48 NOT NULL,
	"max_hours_per_month" real DEFAULT 180 NOT NULL,
	"max_consecutive_days" integer DEFAULT 6 NOT NULL,
	"max_night_shifts_per_week" integer DEFAULT 3,
	"max_night_shifts_per_month" integer DEFAULT 8,
	"min_rest_hours_between_shifts" real DEFAULT 11 NOT NULL,
	"min_days_off_per_month" integer DEFAULT 4 NOT NULL,
	"weight_hours_excess" real DEFAULT 0.4,
	"weight_consecutive_days" real DEFAULT 0.3,
	"weight_night_shifts" real DEFAULT 0.2,
	"weight_rest_deficit" real DEFAULT 0.1,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carbon_emission_factors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fuel_type" text NOT NULL,
	"g_co2_per_km" real NOT NULL,
	"g_co2_per_liter" real,
	"private_car_g_co2_per_km" real DEFAULT 120,
	"source" text,
	"valid_from" date,
	"valid_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carbon_emission_factors_fuel_type_unique" UNIQUE("fuel_type")
);
--> statement-breakpoint
CREATE TABLE "chat_message_reads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" text NOT NULL,
	"sender_vehicle_id" varchar,
	"sender_vehicle_code" text,
	"sender_location_id" varchar,
	"sender_location_name" text,
	"message" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"is_priority" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"vehicle_code" text NOT NULL,
	"location_id" varchar,
	"checklist_id" varchar,
	"submitted_by_id" varchar NOT NULL,
	"submitted_by_name" text NOT NULL,
	"description" text,
	"photo_data" text NOT NULL,
	"photo_mime_type" text DEFAULT 'image/jpeg',
	"is_read" boolean DEFAULT false,
	"is_resolved" boolean DEFAULT false,
	"resolved_by_name" text,
	"resolved_at" timestamp,
	"resolved_notes" text,
	"read_by_name" text,
	"read_at" timestamp,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_template_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"sub_zone" text,
	"description" text,
	"quantity" integer DEFAULT 1,
	"is_required" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"has_expiry" boolean DEFAULT false,
	"expiry_date" date,
	"expiry_alert_days" integer DEFAULT 30,
	"zone_color" text,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_vehicles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"hourly_rate" real,
	"hours_per_week" real,
	"crew_type" text DEFAULT 'autista_soccorritore',
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_name" text NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"required_vehicles" integer,
	"required_hours_per_day" real,
	"default_hourly_rate" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_processing_agreements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processor_name" text NOT NULL,
	"processor_type" text NOT NULL,
	"processor_contact" text,
	"processor_address" text,
	"processor_country" text,
	"agreement_number" text,
	"agreement_date" date NOT NULL,
	"effective_date" date NOT NULL,
	"expiry_date" date,
	"renewal_date" date,
	"data_categories" jsonb NOT NULL,
	"processing_purposes" jsonb NOT NULL,
	"legal_basis" text,
	"transfer_mechanism" text,
	"document_path" text,
	"document_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_audit_date" date,
	"next_audit_date" date,
	"audit_notes" text,
	"has_sub_processors" boolean DEFAULT false,
	"sub_processors" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_anomalies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "monitored_entity" NOT NULL,
	"entity_id" varchar NOT NULL,
	"anomaly_type" "anomaly_type" NOT NULL,
	"status" "anomaly_status" DEFAULT 'open' NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"description" text NOT NULL,
	"details" jsonb,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"resolution_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_key" text NOT NULL,
	"config_value" jsonb NOT NULL,
	"description" text,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "data_quality_config_config_key_unique" UNIQUE("config_key")
);
--> statement-breakpoint
CREATE TABLE "data_quality_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" date NOT NULL,
	"entity_type" "monitored_entity",
	"location_id" varchar,
	"total_records" integer DEFAULT 0,
	"complete_records" integer DEFAULT 0,
	"incomplete_records" integer DEFAULT 0,
	"anomaly_count" integer DEFAULT 0,
	"avg_completeness_score" integer,
	"avg_coherence_score" integer,
	"avg_timeliness_score" integer,
	"avg_accuracy_score" integer,
	"avg_overall_score" integer,
	"realtime_percent" integer,
	"late_percent" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "monitored_entity" NOT NULL,
	"entity_id" varchar NOT NULL,
	"completeness_score" integer DEFAULT 100,
	"coherence_score" integer DEFAULT 100,
	"timeliness_score" integer DEFAULT 100,
	"accuracy_score" integer DEFAULT 100,
	"overall_score" integer DEFAULT 100,
	"missing_fields" jsonb,
	"timeliness_status" timeliness_status,
	"delay_minutes" integer,
	"last_analyzed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"city" text,
	"province" text,
	"vehicle_count" integer,
	"notes" text,
	"status" "demo_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "esg_monthly_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"total_km_traveled" real NOT NULL,
	"total_co2_emitted_kg" real NOT NULL,
	"total_co2_saved_kg" real NOT NULL,
	"avg_co2_per_km" real,
	"electric_km_percent" real,
	"fuel_consumption_liters" real,
	"total_services_completed" integer NOT NULL,
	"total_patients_served" integer,
	"total_volunteer_hours" real,
	"active_volunteers" integer,
	"new_volunteers_recruited" integer,
	"training_hours_delivered" real,
	"avg_patient_satisfaction" real,
	"community_events_participated" integer,
	"audit_logs_generated" integer,
	"compliance_score" real,
	"data_quality_score" real,
	"gdpr_requests_processed" integer,
	"incidents_reported" integer,
	"incidents_resolved" integer,
	"environmental_score" real,
	"social_score" real,
	"governance_score" real,
	"overall_esg_score" real,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"generated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "event_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"vehicle_id" varchar,
	"assigned_role" "shift_role" NOT NULL,
	"status" "assignment_status" DEFAULT 'assigned' NOT NULL,
	"start_time" time,
	"end_time" time,
	"checked_in_at" timestamp,
	"checked_out_at" timestamp,
	"actual_hours_worked" real,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_inventory_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"quantity_out" integer DEFAULT 0 NOT NULL,
	"quantity_returned" integer DEFAULT 0,
	"quantity_used" integer DEFAULT 0,
	"variance_reason" text,
	"checked_out_at" timestamp,
	"checked_out_by" varchar,
	"checked_in_at" timestamp,
	"checked_in_by" varchar,
	"expiry_date" date,
	"lot_number" text,
	"barcode_scan_data" text,
	"status" text DEFAULT 'checked_out',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expiry_correction_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar NOT NULL,
	"item_label" text NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"vehicle_code" text NOT NULL,
	"location_id" varchar,
	"requested_by_id" varchar NOT NULL,
	"requested_by_name" text NOT NULL,
	"current_expiry_date" date,
	"suggested_expiry_date" date,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by_id" varchar,
	"resolved_by_name" text,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_parameters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"param_key" text NOT NULL,
	"param_value" real NOT NULL,
	"unit" text,
	"description" text,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"card_number" text NOT NULL,
	"card_pin" text,
	"provider" text DEFAULT 'LORO' NOT NULL,
	"holder_name" text,
	"expiry_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"fuel_card_id" varchar,
	"date" date NOT NULL,
	"time" time,
	"station_name" text,
	"station_address" text,
	"liters" real NOT NULL,
	"price_per_liter" real,
	"total_cost" real,
	"km_at_refuel" integer,
	"fuel_type" text DEFAULT 'Gasolio',
	"is_self_service" boolean DEFAULT true,
	"receipt_number" text,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_prices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"province" text NOT NULL,
	"fuel_type" text DEFAULT 'Gasolio' NOT NULL,
	"self_service_price" real,
	"full_service_price" real,
	"brand_name" text,
	"station_name" text,
	"station_address" text,
	"date" date NOT NULL,
	"source" text DEFAULT 'MIMIT',
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_data_exports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"request_type" "gdpr_request_type" DEFAULT 'data_export' NOT NULL,
	"status" "gdpr_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"due_by" timestamp with time zone NOT NULL,
	"request_method" text NOT NULL,
	"request_ip_address" text,
	"request_user_agent" text,
	"identity_verified" boolean DEFAULT false,
	"verified_at" timestamp with time zone,
	"verified_by" varchar,
	"verification_method" text,
	"data_categories" jsonb,
	"export_format" text DEFAULT 'json',
	"export_file_path" text,
	"export_file_hash" text,
	"export_file_size" integer,
	"export_generated_at" timestamp with time zone,
	"download_token" text,
	"download_token_expires_at" timestamp with time zone,
	"download_count" integer DEFAULT 0,
	"last_downloaded_at" timestamp with time zone,
	"processed_by" varchar,
	"processing_notes" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_erasure_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"requester_full_name" text,
	"status" "gdpr_request_status" DEFAULT 'pending' NOT NULL,
	"erasure_scope" text DEFAULT 'full' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"due_by" timestamp with time zone NOT NULL,
	"request_method" text NOT NULL,
	"request_reason" text,
	"request_ip_address" text,
	"identity_verified" boolean DEFAULT false,
	"verified_at" timestamp with time zone,
	"verified_by" varchar,
	"data_categories_to_erase" jsonb,
	"excluded_categories" jsonb,
	"retention_reasons" jsonb,
	"use_anonymization" boolean DEFAULT true,
	"anonymization_map" jsonb,
	"processed_by" varchar,
	"processing_notes" text,
	"error_message" text,
	"confirmation_sent_at" timestamp with time zone,
	"confirmation_method" text,
	"erasure_log" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handoffs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"vehicle_code" text NOT NULL,
	"location_id" varchar,
	"created_by_user_id" varchar NOT NULL,
	"created_by_name" text NOT NULL,
	"shift_type" text,
	"fuel_level" integer,
	"current_km" integer,
	"vehicle_condition" text DEFAULT 'ok',
	"has_anomalies" boolean DEFAULT false,
	"anomalies" jsonb,
	"notes" text,
	"message" text,
	"priority" text DEFAULT 'normal',
	"category" text DEFAULT 'general',
	"km_at_handoff" integer,
	"materials_used" jsonb,
	"materials_needed" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"read_by_user_id" varchar,
	"read_by_name" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_check_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_name" text NOT NULL,
	"endpoint" text,
	"status" "health_check_status" NOT NULL,
	"response_time_ms" integer,
	"status_code" integer,
	"error_message" text,
	"metadata" jsonb,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_availability_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"date" date NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"start_time" time,
	"end_time" time,
	"max_bookings" integer,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_availability_slots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"max_bookings" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"location_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"convention_id" varchar,
	"booking_number" text NOT NULL,
	"status" "hub_booking_status" DEFAULT 'pending' NOT NULL,
	"requested_date" date NOT NULL,
	"requested_time_start" time NOT NULL,
	"requested_time_end" time,
	"service_type" text NOT NULL,
	"patient_first_name" text,
	"patient_last_name" text,
	"patient_fiscal_code" text,
	"patient_phone" text,
	"patient_gender" text,
	"patient_birth_year" integer,
	"patient_notes" text,
	"pickup_address" text NOT NULL,
	"pickup_city" text,
	"pickup_notes" text,
	"dropoff_address" text NOT NULL,
	"dropoff_city" text,
	"dropoff_notes" text,
	"needs_wheelchair" boolean DEFAULT false,
	"needs_stretcher" boolean DEFAULT false,
	"needs_oxygen" boolean DEFAULT false,
	"round_trip" boolean DEFAULT false,
	"return_time" time,
	"estimated_km" real,
	"estimated_cost" real,
	"final_cost" real,
	"assigned_vehicle_id" varchar,
	"assigned_by" varchar,
	"assigned_at" timestamp,
	"confirmed_at" timestamp,
	"started_at" timestamp,
	"patient_aboard_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"reject_reason" text,
	"admin_notes" text,
	"client_notes" text,
	"transport_reason" text,
	"transport_details" text,
	"patient_birth_date" text,
	"companion_first_name" text,
	"companion_last_name" text,
	"companion_phone" text,
	"floor_assistance" boolean DEFAULT false,
	"weight_supplement" text,
	"estimated_duration" integer,
	"invoice_requested" boolean DEFAULT false,
	"invoice_data" text,
	"actual_km" real,
	"trip_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"client_type" "hub_client_type" NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone" text,
	"birth_date" text,
	"gender" text,
	"fiscal_code" text,
	"facility_name" text,
	"facility_type" text,
	"facility_vat_number" text,
	"facility_address" text,
	"facility_city" text,
	"facility_province" text,
	"facility_postal_code" text,
	"facility_contact_person" text,
	"facility_phone" text,
	"facility_email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_conventions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "hub_convention_status" DEFAULT 'pending' NOT NULL,
	"hourly_rate" real,
	"per_trip_rate" real,
	"monthly_flat_rate" real,
	"max_trips_per_month" integer,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"terms" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_discount_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_km" numeric(10, 1),
	"max_km" numeric(10, 1),
	"max_uses" integer,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_id" varchar NOT NULL,
	"booking_id" varchar,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"sent_via_email" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_service_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"service_type" text NOT NULL,
	"service_name" text NOT NULL,
	"service_description" text,
	"base_fee" real DEFAULT 25 NOT NULL,
	"per_km_rate" real DEFAULT 0.9 NOT NULL,
	"night_supplement" real DEFAULT 0,
	"holiday_supplement" real DEFAULT 0,
	"waiting_time_rate" real DEFAULT 0,
	"stretcher_supplement" real DEFAULT 0,
	"wheelchair_supplement" real DEFAULT 0,
	"oxygen_supplement" real DEFAULT 0,
	"medical_staff_supplement" real DEFAULT 0,
	"round_trip_discount" real DEFAULT 0,
	"minimum_charge" real DEFAULT 50,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_expiry_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_inventory_id" varchar,
	"warehouse_stock_id" varchar,
	"item_id" varchar NOT NULL,
	"expiry_date" date NOT NULL,
	"alert_type" text NOT NULL,
	"is_acknowledged" boolean DEFAULT false,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "inventory_category" NOT NULL,
	"sku" text,
	"barcode" text,
	"unit" text DEFAULT 'pz' NOT NULL,
	"min_stock_level" integer DEFAULT 5,
	"has_expiry" boolean DEFAULT false,
	"expiry_alert_days" integer DEFAULT 30,
	"expiry_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_replenish" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"warehouse_stock_id" varchar,
	"location_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"barcode_scan_data" text,
	"expiry_date" date,
	"lot_number" text,
	"replenished_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"trip_id" varchar,
	"quantity" integer DEFAULT 1 NOT NULL,
	"reason" text,
	"used_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_distances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" varchar NOT NULL,
	"location_name" text NOT NULL,
	"default_distance_km" real NOT NULL,
	"custom_distances" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "location_distances_location_id_unique" UNIQUE("location_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"organization_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_restorations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar NOT NULL,
	"item_label" text NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"vehicle_code" text NOT NULL,
	"old_expiry_date" date,
	"new_expiry_date" date NOT NULL,
	"restored_by_id" varchar,
	"restored_by_name" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_workload" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"week_start_date" date NOT NULL,
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"hours_worked_mon" real DEFAULT 0,
	"hours_worked_tue" real DEFAULT 0,
	"hours_worked_wed" real DEFAULT 0,
	"hours_worked_thu" real DEFAULT 0,
	"hours_worked_fri" real DEFAULT 0,
	"hours_worked_sat" real DEFAULT 0,
	"hours_worked_sun" real DEFAULT 0,
	"total_hours_week" real DEFAULT 0 NOT NULL,
	"night_shifts_count" integer DEFAULT 0,
	"consecutive_days_worked" integer DEFAULT 0,
	"min_rest_between_shifts" real,
	"risk_level" "burnout_risk_level" DEFAULT 'low',
	"risk_score" real DEFAULT 0,
	"risk_factors" jsonb,
	"alert_sent" boolean DEFAULT false,
	"alert_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_health_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"login_frequency" real DEFAULT 0,
	"trips_per_week" real DEFAULT 0,
	"feature_adoption" real DEFAULT 0,
	"data_completeness" real DEFAULT 0,
	"last_active_at" timestamp,
	"days_since_last_login" integer,
	"support_tickets" integer DEFAULT 0,
	"health_score" real DEFAULT 0,
	"risk_level" text DEFAULT 'healthy',
	"trend" text DEFAULT 'stable',
	"recommended_action" text,
	"last_calculated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_score_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"total_trips_last_12m" integer DEFAULT 0,
	"avg_response_time_min" real,
	"fleet_size" integer DEFAULT 0,
	"active_personnel" integer DEFAULT 0,
	"coverage_area_km2" real,
	"total_km_last_12m" real,
	"operational_score" real DEFAULT 0,
	"compliance_score" real DEFAULT 0,
	"sustainability_score" real DEFAULT 0,
	"financial_score" real DEFAULT 0,
	"overall_score" real DEFAULT 0,
	"has_iso_9001" boolean DEFAULT false,
	"has_iso_45001" boolean DEFAULT false,
	"has_iso_14001" boolean DEFAULT false,
	"last_calculated_at" timestamp,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"module_key" text NOT NULL,
	"module_name" text,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"billing_period" text DEFAULT 'monthly',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"amount" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"legal_name" text,
	"vat_number" text,
	"fiscal_code" text,
	"address" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"phone" text,
	"email" text,
	"pec" text,
	"website" text,
	"logo_url" text,
	"status" "org_status" DEFAULT 'trial' NOT NULL,
	"max_vehicles" integer DEFAULT 5,
	"max_users" integer DEFAULT 20,
	"trial_ends_at" timestamp,
	"notes" text,
	"enabled_modules" jsonb DEFAULT '[]'::jsonb,
	"is_demo" boolean DEFAULT false,
	"demo_expires_at" timestamp,
	"demo_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_name_unique" UNIQUE("name"),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "partner_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp,
	"processed_by" varchar,
	"processing_notes" text,
	"partner_id" varchar,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" varchar NOT NULL,
	"staff_member_id" varchar,
	"user_id" varchar,
	"rating" integer NOT NULL,
	"comment" text,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" varchar NOT NULL,
	"staff_member_id" varchar,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"verification_method" text DEFAULT 'qr',
	"device_info" text
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"vat_number" text,
	"fiscal_code" text,
	"category" text DEFAULT 'altro' NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"website" text,
	"address" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"latitude" text,
	"longitude" text,
	"logo_url" text,
	"description" text,
	"discount_type" text DEFAULT 'percentage',
	"discount_value" text,
	"discount_description" text,
	"valid_from" date,
	"valid_until" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"tier" text DEFAULT 'bronze' NOT NULL,
	"total_verifications" integer DEFAULT 0,
	"average_rating" real,
	"total_reviews" integer DEFAULT 0,
	"notes" text,
	"approved_at" timestamp,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"invoice_number" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"status" text NOT NULL,
	"description" text,
	"module_key" text,
	"module_name" text,
	"billing_period" text,
	"org_name" text,
	"org_vat_number" text,
	"org_address" text,
	"org_fiscal_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_report_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_report_id" varchar NOT NULL,
	"sender_type" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_read_by_crew" boolean DEFAULT false,
	"is_read_by_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictive_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"predicted_date" timestamp,
	"confidence" real,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"suggested_action" text,
	"status" text DEFAULT 'active' NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "premium_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"long_description" text,
	"category" text DEFAULT 'modulo' NOT NULL,
	"icon" text DEFAULT 'package',
	"badge_text" text,
	"badge_color" text,
	"price_monthly" integer DEFAULT 0 NOT NULL,
	"price_yearly" integer DEFAULT 0 NOT NULL,
	"price_one_time" integer,
	"billing_type" text DEFAULT 'recurring' NOT NULL,
	"trial_days" integer DEFAULT 0,
	"max_users" integer,
	"stripe_price_id_monthly" text,
	"stripe_price_id_yearly" text,
	"stripe_product_id" text,
	"features" jsonb DEFAULT '[]'::jsonb,
	"requirements" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "premium_modules_module_key_unique" UNIQUE("module_key")
);
--> statement-breakpoint
CREATE TABLE "privacy_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"summary" text,
	"effective_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"language" text DEFAULT 'it' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"legal_basis" text,
	"data_processing_purposes" jsonb,
	"data_categories" jsonb,
	"data_retention_period" text,
	"third_party_recipients" jsonb,
	"published_by" varchar,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_policies_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "recovery_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backup_id" varchar NOT NULL,
	"test_type" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"result_summary" text,
	"result_details" jsonb,
	"tested_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reimbursement_shifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reimbursement_id" varchar NOT NULL,
	"shift_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"hours_worked" real NOT NULL,
	"location_id" varchar NOT NULL,
	"location_name" text NOT NULL,
	"km_distance" real NOT NULL,
	"km_rate" real NOT NULL,
	"km_amount" real NOT NULL,
	"has_meal" boolean DEFAULT true NOT NULL,
	"meal_amount" real NOT NULL,
	"total_amount" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rescue_sheets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progressive_number" text NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"vehicle_code" text NOT NULL,
	"user_id" varchar NOT NULL,
	"location_id" varchar,
	"sheet_date" date NOT NULL,
	"dispatch_code" text,
	"ora_attivazione" text,
	"inizio_missione" text,
	"arrivo_posto" text,
	"partenza_posto" text,
	"arrivo_rv" text,
	"partenza_da_rv" text,
	"arrivo_in_h" text,
	"operativo_fine_1" text,
	"in_base_fine_2" text,
	"sospeso" boolean DEFAULT false,
	"non_reperito" boolean DEFAULT false,
	"si_allontana" boolean DEFAULT false,
	"rientra_in_eli" boolean DEFAULT false,
	"rendez_vous_idroambulanza" boolean DEFAULT false,
	"luogo_comune" text,
	"luogo_via" text,
	"luogo_prov" text,
	"luogo_nr" text,
	"luogo_riferimenti" text,
	"coinvolti" integer,
	"idem_residenza" boolean DEFAULT false,
	"paziente_cognome" text,
	"paziente_nome" text,
	"paziente_sesso" text,
	"paziente_eta_anni" integer,
	"paziente_eta_mesi" integer,
	"paziente_eta_giorni" integer,
	"paziente_nato_il" text,
	"paziente_cf" text,
	"residenza_comune" text,
	"residenza_via" text,
	"residenza_nr" text,
	"residenza_prov" text,
	"residenza_stato_estero" text,
	"cittadinanza_ita" boolean DEFAULT true,
	"paziente_email" text,
	"gia_sul_posto" jsonb,
	"codice_missione" text,
	"destinazione_ps" boolean DEFAULT false,
	"equipaggio" jsonb,
	"evento_medico" jsonb,
	"evento_traumatico" jsonb,
	"evento_infortunio" boolean DEFAULT false,
	"evento_intossicazione" boolean DEFAULT false,
	"luogo_evento" text,
	"presenti_sul_posto" jsonb,
	"allertamento_msa" text,
	"rinvenimento" text,
	"rinvenimento_laterale" text,
	"rinvenimento_note" text,
	"valutazione_a" jsonb,
	"valutazione_b" jsonb,
	"valutazione_c" jsonb,
	"valutazione_d" jsonb,
	"valutazione_e" jsonb,
	"parametri_vitali" jsonb,
	"altri_segni_sintomi" jsonb,
	"rcp" jsonb,
	"prestazioni" jsonb,
	"presidi" jsonb,
	"dinamica_trauma" jsonb,
	"rifiuto_trasporto" boolean DEFAULT false,
	"rifiuto_trattamento" boolean DEFAULT false,
	"firma_rifiuto" text,
	"note" text,
	"consegna_ps_nome" text,
	"consegna_ps_tipo" text,
	"consegna_ps_ore" text,
	"consegna_ps_firma" text,
	"firma_compilatore" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_forecasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"forecast_month" date NOT NULL,
	"projected_revenue" real,
	"projected_costs" real,
	"projected_profit" real,
	"projected_trips" integer,
	"projected_km" real,
	"confidence_level" real,
	"forecast_model" text DEFAULT 'linear',
	"actual_revenue" real,
	"actual_costs" real,
	"actual_profit" real,
	"actual_trips" integer,
	"revenue_variance" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"contract_name" text NOT NULL,
	"trip_type" text,
	"base_fee" real NOT NULL,
	"per_km_rate" real,
	"per_minute_rate" real,
	"minimum_fee" real,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_date" date NOT NULL,
	"mrr" real DEFAULT 0,
	"arr" real DEFAULT 0,
	"new_mrr" real DEFAULT 0,
	"churned_mrr" real DEFAULT 0,
	"expansion_mrr" real DEFAULT 0,
	"total_orgs" integer DEFAULT 0,
	"active_orgs" integer DEFAULT 0,
	"trial_orgs" integer DEFAULT 0,
	"churned_orgs" integer DEFAULT 0,
	"new_orgs_this_month" integer DEFAULT 0,
	"total_trips_all_orgs" integer DEFAULT 0,
	"total_users_all_orgs" integer DEFAULT 0,
	"total_vehicles_all_orgs" integer DEFAULT 0,
	"avg_trips_per_org" real,
	"avg_health_score" real,
	"at_risk_orgs" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanitization_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"vehicle_code" text NOT NULL,
	"sanitization_type" "sanitization_type" NOT NULL,
	"operator_name" text NOT NULL,
	"operator_user_id" varchar NOT NULL,
	"notes" text,
	"products_used" text,
	"trip_id" varchar,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scadenze_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"submitted_by_user_id" varchar NOT NULL,
	"submitted_by_name" text NOT NULL,
	"report_month" integer NOT NULL,
	"report_year" integer NOT NULL,
	"completed_at" timestamp NOT NULL,
	"total_items_checked" integer DEFAULT 0,
	"expired_items_count" integer DEFAULT 0,
	"expiring_items_count" integer DEFAULT 0,
	"items" jsonb NOT NULL,
	"notes" text,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"progressive_code" text,
	"service_date" date NOT NULL,
	"scheduled_time" time,
	"patient_name" text,
	"patient_condition" text,
	"patient_weight" integer,
	"patient_phone" text,
	"patient_notes" text,
	"origin_address" text,
	"origin_city" text,
	"origin_province" text,
	"origin_floor" text,
	"origin_bell" text,
	"destination_name" text,
	"destination_address" text,
	"destination_city" text,
	"destination_province" text,
	"destination_floor" text,
	"destination_phone" text,
	"service_type" text,
	"estimated_km" real,
	"precautions" text,
	"transport_mode" text,
	"notes" text,
	"additional_personnel" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_cancelled" boolean DEFAULT false,
	"linked_trip_id" varchar,
	"source_pdf_name" text,
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_incidents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_type" text NOT NULL,
	"severity" text NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"detected_by" varchar,
	"detection_method" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"affected_systems" jsonb,
	"affected_data_categories" jsonb,
	"affected_users_count" integer,
	"affected_users_notified" boolean DEFAULT false,
	"users_notified_at" timestamp with time zone,
	"dpa_notification_required" boolean DEFAULT false,
	"dpa_notified_at" timestamp with time zone,
	"dpa_notification_reference" text,
	"status" text DEFAULT 'open' NOT NULL,
	"contained_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"root_cause" text,
	"remediation_steps" jsonb,
	"preventive_measures" jsonb,
	"incident_report_path" text,
	"assigned_to" varchar,
	"reviewed_by" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progressive_number" text,
	"vehicle_id" varchar,
	"location_id" varchar,
	"assigned_by" varchar,
	"service_date" date NOT NULL,
	"pickup_time" time,
	"appointment_time" time,
	"estimated_return_time" time,
	"patient_name" text,
	"patient_phone" text,
	"patient_notes" text,
	"departure_type" text,
	"departure_address" text,
	"departure_city" text,
	"departure_structure_id" varchar,
	"departure_department" text,
	"destination_type" text,
	"destination_address" text,
	"destination_city" text,
	"destination_structure_id" varchar,
	"destination_department" text,
	"service_type" text DEFAULT 'altro',
	"is_round_trip" boolean DEFAULT false,
	"needs_wheelchair" boolean DEFAULT false,
	"needs_stretcher" boolean DEFAULT false,
	"needs_oxygen" boolean DEFAULT false,
	"pdf_file_name" text,
	"pdf_uploaded_at" timestamp,
	"extracted_data" jsonb,
	"trip_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"cancelled_reason" text,
	"central_notes" text,
	"crew_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"event_type" "service_event_type" NOT NULL,
	"description" text,
	"location_id" varchar NOT NULL,
	"event_address" text,
	"event_city" text,
	"coordinates" jsonb,
	"event_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"setup_time" time,
	"vehicles_required" integer DEFAULT 1,
	"staff_required" integer DEFAULT 2,
	"required_roles" jsonb,
	"required_qualifications" jsonb,
	"assigned_vehicle_ids" jsonb,
	"client_name" text,
	"client_contact" text,
	"client_phone" text,
	"client_email" text,
	"contract_reference" text,
	"estimated_revenue" real,
	"actual_revenue" real,
	"status" text DEFAULT 'planned' NOT NULL,
	"is_covered" boolean DEFAULT false,
	"notes" text,
	"internal_notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" text NOT NULL,
	"actor_id" varchar,
	"actor_name" text,
	"actor_role" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"description" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_instance_id" varchar NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"assigned_role" "shift_role" NOT NULL,
	"role_slot_index" integer DEFAULT 0,
	"status" "assignment_status" DEFAULT 'assigned' NOT NULL,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"checked_in_at" timestamp,
	"checked_out_at" timestamp,
	"checked_in_by" varchar,
	"actual_hours_worked" real,
	"overtime_hours" real DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" varchar,
	"user_name" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"shift_instance_id" varchar,
	"location_id" varchar,
	"location_name" text,
	"vehicle_code" text,
	"shift_date" text,
	"staff_member_name" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"description" text NOT NULL,
	"organization_id" varchar
);
--> statement-breakpoint
CREATE TABLE "shift_instances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"location_id" varchar NOT NULL,
	"vehicle_id" varchar,
	"shift_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"actual_start_time" time,
	"actual_end_time" time,
	"crew_type" text DEFAULT 'autista_soccorritore',
	"required_roles" jsonb NOT NULL,
	"min_staff" integer DEFAULT 2,
	"max_staff" integer DEFAULT 3,
	"current_staff_count" integer DEFAULT 0,
	"status" "shift_status" DEFAULT 'draft' NOT NULL,
	"is_covered" boolean DEFAULT false,
	"coverage_percent" integer DEFAULT 0,
	"allow_self_signup" boolean DEFAULT true,
	"event_id" varchar,
	"notes" text,
	"is_manual_override" boolean DEFAULT false,
	"override_reason" text,
	"published_at" timestamp,
	"published_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"shift_date" date NOT NULL,
	"event_type" text NOT NULL,
	"event_time" time NOT NULL,
	"km_reading" integer,
	"description" text,
	"latitude" text,
	"longitude" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_swap_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" varchar NOT NULL,
	"requester_assignment_id" varchar NOT NULL,
	"target_staff_id" varchar,
	"target_assignment_id" varchar,
	"swap_type" text NOT NULL,
	"status" "swap_request_status" DEFAULT 'pending' NOT NULL,
	"responded_by" varchar,
	"responded_at" timestamp,
	"response_note" text,
	"admin_approved_by" varchar,
	"admin_approved_at" timestamp,
	"admin_note" text,
	"expires_at" timestamp,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location_id" varchar NOT NULL,
	"vehicle_id" varchar,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"duration_hours" real,
	"crew_type" text DEFAULT 'autista_soccorritore',
	"required_roles" jsonb NOT NULL,
	"min_staff" integer DEFAULT 2,
	"max_staff" integer DEFAULT 3,
	"is_recurring" boolean DEFAULT true,
	"recurrence_pattern" text DEFAULT 'daily',
	"recurrence_days" jsonb,
	"required_qualifications" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_breaches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sla_target_id" varchar NOT NULL,
	"service_name" text NOT NULL,
	"metric_type" "sla_metric_type" NOT NULL,
	"target_value" real NOT NULL,
	"actual_value" real NOT NULL,
	"breach_severity" text NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_type" "sla_metric_type" NOT NULL,
	"service_name" text NOT NULL,
	"value" real NOT NULL,
	"unit" text NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_targets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_name" text NOT NULL,
	"metric_type" "sla_metric_type" NOT NULL,
	"target_value" real NOT NULL,
	"warning_threshold" real,
	"critical_threshold" real,
	"period" text DEFAULT 'monthly' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soccorso_live_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"vehicle_code" text,
	"location_name" text,
	"mode" text,
	"service_data" jsonb NOT NULL,
	"route_data" jsonb,
	"total_km" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "soccorso_live_reports_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sporting_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"event_type" text NOT NULL,
	"location" text NOT NULL,
	"address" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"start_time" time,
	"end_time" time,
	"expected_attendees" integer,
	"vehicle_id" varchar,
	"coordinator_id" varchar,
	"template_id" varchar,
	"status" text DEFAULT 'planned',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_availability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"date_start" date NOT NULL,
	"date_end" date NOT NULL,
	"time_start" time,
	"time_end" time,
	"availability_type" text NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"recurrence_days" jsonb,
	"reason" text,
	"is_approved" boolean DEFAULT true,
	"approved_by" varchar,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_breathing_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"duration_seconds" integer NOT NULL,
	"completed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_confidentiality_agreements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"fiscal_code" text,
	"email" text,
	"phone" text,
	"staff_type" text NOT NULL,
	"role" text,
	"location_id" varchar,
	"agreement_version" text DEFAULT '1.0' NOT NULL,
	"agreement_text" text NOT NULL,
	"agreement_hash" text NOT NULL,
	"accepted_terms" boolean DEFAULT false NOT NULL,
	"accepted_gdpr" boolean DEFAULT false NOT NULL,
	"accepted_no_disclosure" boolean DEFAULT false NOT NULL,
	"accepted_no_photos" boolean DEFAULT false NOT NULL,
	"accepted_data_protection" boolean DEFAULT false NOT NULL,
	"signature_data_url" text NOT NULL,
	"signature_timestamp" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"device_id" text,
	"is_valid" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_convenzioni" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"city" text NOT NULL,
	"discount" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"reason" text,
	"contact_info" text,
	"valid_until" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_course_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" varchar NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"status" text DEFAULT 'iscritto' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "staff_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"number" text,
	"expiry_date" date,
	"status" text DEFAULT 'valido' NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"fiscal_code" text,
	"email" text,
	"phone" text,
	"location_id" varchar NOT NULL,
	"home_address" text,
	"home_city" text,
	"home_province" text,
	"home_postal_code" text,
	"home_distance_km" real,
	"iban" text,
	"primary_role" "shift_role" NOT NULL,
	"secondary_roles" jsonb,
	"qualifications" jsonb,
	"qualification_expiries" jsonb,
	"max_hours_per_week" integer DEFAULT 40,
	"max_hours_per_month" integer DEFAULT 160,
	"preferred_vehicle_ids" jsonb,
	"unavailable_dates" jsonb,
	"contract_type" text,
	"contract_start_date" date,
	"contract_end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	CONSTRAINT "staff_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "staff_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"type" "staff_milestone_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"achieved_at" timestamp DEFAULT now() NOT NULL,
	"celebrated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_roles_costs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar NOT NULL,
	"role_key" "staff_role_key",
	"role_name" text NOT NULL,
	"hourly_cost" real NOT NULL,
	"hours_per_trip" real,
	"monthly_fixed_cost" real,
	"description" text,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_shift_karma" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"favors_given" integer DEFAULT 0 NOT NULL,
	"favors_received" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_shift_karma_staff_member_id_unique" UNIQUE("staff_member_id")
);
--> statement-breakpoint
CREATE TABLE "staff_training_courses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"duration_hours" integer NOT NULL,
	"start_date" date,
	"end_date" date,
	"location" text,
	"max_participants" integer,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_training_pills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"scenario" text,
	"reason" text,
	"tip" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_wellness_checkins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"date" date NOT NULL,
	"state" "staff_wellness_state" NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structure_departments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"structure_id" varchar NOT NULL,
	"department_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structure_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"structure_type" text,
	"parent_structure_id" varchar,
	"submitted_by_user_id" varchar,
	"submitted_by_name" text,
	"vehicle_code" text,
	"status" "structure_request_status" DEFAULT 'pending' NOT NULL,
	"resolved_structure_id" varchar,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" text,
	"longitude" text,
	"type" text DEFAULT 'ospedale' NOT NULL,
	"phone_number" text,
	"access_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sustainability_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"target_co2_reduction_percent" real,
	"target_km_efficiency_improvement" real,
	"target_electric_fleet_percent" real,
	"target_volunteer_hours" integer,
	"target_training_hours" integer,
	"target_patient_satisfaction" real,
	"target_audit_compliance_percent" real,
	"target_data_quality_score" real,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_backups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backup_type" "backup_type" NOT NULL,
	"status" "backup_status" DEFAULT 'pending' NOT NULL,
	"source_name" text NOT NULL,
	"file_name" text,
	"file_path" text,
	"file_size_bytes" integer,
	"checksum" text,
	"encryption_key" text,
	"is_encrypted" boolean DEFAULT true NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"expires_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"metadata" jsonb,
	"verified_at" timestamp,
	"verification_result" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"required_quantity" integer DEFAULT 1 NOT NULL,
	"min_quantity" integer DEFAULT 1,
	"is_essential" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tender_monitors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"cpv_code" text,
	"cig_code" text,
	"statione_name" text,
	"estimated_value" real,
	"deadline" timestamp,
	"publication_date" timestamp,
	"region" text,
	"province" text,
	"service_type" text,
	"status" text DEFAULT 'new' NOT NULL,
	"required_vehicles" integer,
	"required_personnel" integer,
	"duration_months" integer,
	"notes" text,
	"priority" text DEFAULT 'medium',
	"assigned_to" varchar,
	"is_auto_detected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tender_simulations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"tender_id" varchar,
	"name" text NOT NULL,
	"vehicles_count" integer DEFAULT 1 NOT NULL,
	"personnel_count" integer DEFAULT 2 NOT NULL,
	"hours_per_day" real DEFAULT 12 NOT NULL,
	"days_per_month" integer DEFAULT 30 NOT NULL,
	"duration_months" integer DEFAULT 12 NOT NULL,
	"fuel_cost_monthly" real,
	"personnel_cost_monthly" real,
	"vehicle_cost_monthly" real,
	"insurance_cost_monthly" real,
	"maintenance_cost_monthly" real,
	"overhead_cost_monthly" real,
	"total_cost_monthly" real,
	"margin_percent" real DEFAULT 15,
	"proposed_monthly_price" real,
	"proposed_total_price" real,
	"price_per_hour" real,
	"price_per_km" real,
	"market_avg_price" real,
	"competitiveness_score" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_carbon_footprint" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" varchar NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"km_traveled" real NOT NULL,
	"fuel_type" text NOT NULL,
	"co2_emitted_kg" real NOT NULL,
	"co2_per_km" real NOT NULL,
	"co2_if_private_car" real NOT NULL,
	"co2_saved_kg" real NOT NULL,
	"occupancy_factor" real DEFAULT 1,
	"efficiency_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_carbon_footprint_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "trip_device_authorizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" varchar NOT NULL,
	"authorizer_type" "device_authorizer_type" NOT NULL,
	"authorizer_name" text,
	"signature_data" text,
	"signature_mime_type" text DEFAULT 'image/png',
	"authorized_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trip_device_authorizations_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "trip_gps_points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" varchar NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"accuracy" real,
	"speed" real,
	"heading" real,
	"altitude" real,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_waypoints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" varchar NOT NULL,
	"waypoint_order" integer NOT NULL,
	"waypoint_type" text NOT NULL,
	"location_type" text NOT NULL,
	"structure_id" varchar,
	"department_id" varchar,
	"address" text,
	"latitude" text,
	"longitude" text,
	"km_from_previous" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progressive_number" text NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"service_date" date NOT NULL,
	"departure_time" time,
	"return_time" time,
	"patient_birth_year" integer,
	"patient_gender" text,
	"origin_type" text NOT NULL,
	"origin_structure_id" varchar,
	"origin_department_id" varchar,
	"origin_address" text,
	"destination_type" text NOT NULL,
	"destination_structure_id" varchar,
	"destination_department_id" varchar,
	"destination_address" text,
	"km_initial" integer NOT NULL,
	"km_final" integer NOT NULL,
	"km_traveled" integer NOT NULL,
	"duration_minutes" integer,
	"service_type" text,
	"is_emergency_service" boolean DEFAULT false,
	"total_waypoint_km" integer,
	"crew_type" text DEFAULT 'autista_soccorritore',
	"is_return_trip" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"integrity_hash" text,
	"integrity_signed_at" timestamp,
	"integrity_algorithm" text,
	"integrity_status" "integrity_status" DEFAULT 'NOT_SIGNED',
	"pdf_hash" text,
	"pdf_hash_generated_at" timestamp,
	"organization_id" varchar
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"policy_id" varchar,
	"policy_version" text,
	"status" "consent_status" NOT NULL,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"consent_method" text NOT NULL,
	"consent_source" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"device_id" text,
	"consent_text" text,
	"consent_checksum" text,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"is_primary" boolean DEFAULT true,
	"can_manage_fleet" boolean DEFAULT true,
	"can_manage_shifts" boolean DEFAULT true,
	"can_manage_inventory" boolean DEFAULT true,
	"can_manage_events" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"notifications_enabled" boolean DEFAULT true,
	"sound_enabled" boolean DEFAULT true,
	"vibration_enabled" boolean DEFAULT true,
	"checklist_reminder_enabled" boolean DEFAULT true,
	"checklist_reminder_time" text DEFAULT '07:00',
	"expiry_alerts_enabled" boolean DEFAULT true,
	"scadenze_reminder_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'crew' NOT NULL,
	"account_type" text DEFAULT 'vehicle' NOT NULL,
	"vehicle_id" varchar,
	"location_id" varchar,
	"organization_id" varchar,
	"auth_token" text,
	"last_login_at" timestamp,
	"last_logout_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicle_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"location_id" varchar,
	"submitted_by_id" varchar NOT NULL,
	"submitted_by_name" text NOT NULL,
	"shift_date" date NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"items" jsonb NOT NULL,
	"has_anomalies" boolean DEFAULT false,
	"anomaly_description" text,
	"general_notes" text,
	"monthly_report_sent" boolean DEFAULT false,
	"monthly_report_sent_at" timestamp,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "vehicle_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"vehicle_code" text NOT NULL,
	"document_type" "document_type" NOT NULL,
	"document_label" text NOT NULL,
	"expiry_date" date,
	"issue_date" date,
	"document_number" text,
	"notes" text,
	"photo_base64" text,
	"uploaded_by_name" text NOT NULL,
	"uploaded_by_user_id" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"current_quantity" integer DEFAULT 0 NOT NULL,
	"required_quantity" integer DEFAULT 1 NOT NULL,
	"expiry_date" date,
	"lot_number" text,
	"last_checked_at" timestamp,
	"last_checked_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_inventory_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"template_type" "template_type" DEFAULT 'MSB' NOT NULL,
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_template_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" varchar NOT NULL,
	"status" text DEFAULT 'active',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"license_plate" text,
	"model" text,
	"vehicle_type" text DEFAULT 'MSB',
	"assigned_template_id" varchar,
	"displacement" integer,
	"kw" integer,
	"fuel_type" text DEFAULT 'Gasolio',
	"location_id" varchar NOT NULL,
	"current_km" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"latitude" text,
	"longitude" text,
	"last_location_at" timestamp,
	"is_on_service" boolean DEFAULT false,
	"fuel_consumption_per_100km" real,
	"maintenance_cost_per_km" real,
	"insurance_cost_monthly" real,
	"driver_hourly_cost" real,
	"hourly_operating_cost" real,
	"hourly_revenue_rate" real,
	"default_crew_type" text DEFAULT 'autista_soccorritore',
	"next_revision_date" date,
	"next_service_date" date,
	"revision_km" integer,
	"maintenance_status" text DEFAULT 'ok',
	"last_maintenance_date" date,
	"last_maintenance_km" integer,
	"brand" text,
	"year" integer,
	"assigned_contract_name" text,
	"assigned_contract_logo" text,
	"work_schedule_start" text,
	"work_schedule_end" text,
	"is_assigned_to_event" boolean DEFAULT false,
	"event_name" text,
	"event_date" date,
	"nato_name" text,
	"schedule_roles" text DEFAULT 'autista,soccorritore',
	"schedule_shift_start" text,
	"schedule_shift_end" text,
	"schedule_shifts" text,
	"schedule_color" text,
	"schedule_enabled" boolean DEFAULT true,
	"organization_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_registry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"progressive_number" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"fiscal_code" text,
	"birth_date" date,
	"birth_place" text,
	"gender" text,
	"residence_address" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"phone" text,
	"email" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relation" text,
	"volunteer_type" "volunteer_type" DEFAULT 'continuativo' NOT NULL,
	"volunteer_status" "volunteer_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"start_signature_confirmed" boolean DEFAULT false,
	"start_signature_date" timestamp,
	"end_date" date,
	"end_signature_confirmed" boolean DEFAULT false,
	"end_signature_date" timestamp,
	"end_reason" text,
	"insurance_notified" boolean DEFAULT false,
	"insurance_notified_date" date,
	"insurance_policy_number" text,
	"role" text,
	"qualifications" text,
	"training_completed" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"integrity_hash" text,
	"integrity_signed_at" timestamp,
	"integrity_algorithm" text,
	"integrity_status" text DEFAULT 'NOT_SIGNED',
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_reimbursements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"total_amount" real NOT NULL,
	"total_shifts" integer NOT NULL,
	"total_hours" real NOT NULL,
	"total_km" real NOT NULL,
	"total_meals" integer NOT NULL,
	"avg_km_rate" real,
	"meal_allowance" real DEFAULT 12.5,
	"status" "reimbursement_status" DEFAULT 'draft' NOT NULL,
	"signature_data" text,
	"signed_at" timestamp,
	"signed_from_ip" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"payment_reference" text,
	"pdf_path" text,
	"pdf_generated_at" timestamp,
	"notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" varchar DEFAULT 'croce-europa-default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"volunteer_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"status" "signature_status" DEFAULT 'draft' NOT NULL,
	"document_type" text DEFAULT 'registrazione_volontario' NOT NULL,
	"document_title" text NOT NULL,
	"document_content" text,
	"volunteer_email" text NOT NULL,
	"volunteer_name" text NOT NULL,
	"volunteer_signature_data" text,
	"volunteer_signed_at" timestamp,
	"volunteer_signed_ip" text,
	"org_signature_data" text,
	"org_signed_at" timestamp,
	"org_signed_by" varchar,
	"org_signer_name" text,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"expires_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "volunteer_signatures_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "warehouse_stock" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_stock_level" integer DEFAULT 10,
	"shelf_location" text,
	"last_restocked_at" timestamp,
	"last_restocked_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wellness_checkins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" varchar NOT NULL,
	"checkin_date" date NOT NULL,
	"energy_level" integer,
	"stress_level" integer,
	"sleep_quality" integer,
	"work_life_balance" integer,
	"team_support" integer,
	"job_satisfaction" integer,
	"overall_wellness_score" real,
	"notes" text,
	"needs_support" boolean DEFAULT false,
	"is_anonymous" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "event_assignments_event_staff_unique" ON "event_assignments" USING btree ("event_id","staff_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_name_org_unique" ON "locations" USING btree ("name","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_assignments_shift_staff_unique" ON "shift_assignments" USING btree ("shift_instance_id","staff_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_location_unique" ON "user_locations" USING btree ("user_id","location_id");