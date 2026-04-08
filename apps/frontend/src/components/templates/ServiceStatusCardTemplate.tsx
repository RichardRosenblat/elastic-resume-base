/**
 * @file ServiceStatusCardTemplate.tsx — Reusable service health status card.
 *
 * Displays the operational status of a single downstream service with a
 * user-friendly name, description, state-specific notice, and technical
 * identifier. Designed to be used in the System Status page.
 */
import { Box, Typography, Card, CardContent, Chip } from "@mui/material";
import {
	CheckCircle as CheckCircleIcon,
	Cancel as CancelIcon,
	AccessTime as AccessTimeIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { DownstreamServiceStatus } from "../../types";

/** Maps the Gateway API service key to its canonical technical service name. */
const SERVICE_TECHNICAL_NAMES: Record<string, string> = {
	usersApi: "users-api",
	downloader: "downloader",
	searchBase: "search-base",
	fileGenerator: "file-generator",
	documentReader: "document-reader",
};

/**
 * Derives the user-visible operational state from the registry entry.
 *   - `ready`       — warm and live (instant reply expected)
 *   - `idle`        — cold but live (cold start may be needed)
 *   - `unavailable` — not live (service unreachable)
 */
export function deriveServiceState(service: DownstreamServiceStatus): "ready" | "idle" | "unavailable" {
	if (!service.live) return "unavailable";
	return service.temperature === "warm" ? "ready" : "idle";
}

/**
 * Formats an ISO timestamp for display. Returns the provided fallback label
 * when the value is null or undefined.
 */
function formatTimestamp(iso: string | null | undefined, neverSeenLabel: string): string {
	if (!iso) return neverSeenLabel;
	return new Date(iso).toLocaleString();
}

/** Props for the {@link ServiceStatusCardTemplate} component. */
export interface ServiceStatusCardTemplateProps {
	/** Gateway API key for the service (e.g. `"usersApi"`). */
	name: string;
	/** Raw status data from the downstream health endpoint. */
	service: DownstreamServiceStatus;
}

/**
 * Displays the operational status of a single downstream service with
 * a user-friendly name, description, state-specific notice, and technical
 * identifier.
 */
export default function ServiceStatusCardTemplate({ name, service }: ServiceStatusCardTemplateProps) {
	const { t } = useTranslation();
	const state = deriveServiceState(service);
	const technicalName = SERVICE_TECHNICAL_NAMES[name] ?? name;

	const chipProps = {
		ready: {
			icon: <CheckCircleIcon fontSize="small" />,
			label: t("systemStatus.statusReady"),
			color: "success" as const,
		},
		idle: {
			icon: <AccessTimeIcon fontSize="small" />,
			label: t("systemStatus.statusIdle"),
			color: "warning" as const,
		},
		unavailable: {
			icon: <CancelIcon fontSize="small" />,
			label: t("systemStatus.statusUnavailable"),
			color: "error" as const,
		},
	}[state];

	const neverSeenLabel = t("systemStatus.neverSeen");

	return (
		<Card>
			<CardContent>
				{/* Header row: friendly name + status chip */}
				<Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1} mb={1}>
					<Box>
						<Typography variant="subtitle1" fontWeight={600}>
							{t(`systemStatus.services.${name}.name`)}
						</Typography>
						<Typography variant="caption" color="text.disabled">
							{technicalName}
						</Typography>
					</Box>
					<Chip
						icon={chipProps.icon}
						label={chipProps.label}
						color={chipProps.color}
						size="small"
						sx={{ flexShrink: 0 }}
					/>
				</Box>

				{/* Service description */}
				<Typography variant="body2" color="text.secondary">
					{t(`systemStatus.services.${name}.description`)}
				</Typography>

				{/* State-specific notice — shown only when the service is not ready */}
				{state === "unavailable" && (
					<Typography
						variant="body2"
						color="error.main"
						sx={{ mt: 0.5, fontStyle: "italic" }}
					>
						{t(`systemStatus.services.${name}.impact`)}
					</Typography>
				)}
				{state === "idle" && (
					<Typography
						variant="body2"
						color="warning.main"
						sx={{ mt: 0.5, fontStyle: "italic" }}
					>
						{t("systemStatus.idleMessage")}
					</Typography>
				)}

				{/* Timestamps */}
				<Box mt={1}>
					<Typography variant="caption" color="text.disabled" display="block">
						{t("systemStatus.lastSeenLabel")}:{" "}
						{formatTimestamp(service.lastSeenAlive, neverSeenLabel)}
					</Typography>
					<Typography variant="caption" color="text.disabled" display="block">
						{t("systemStatus.lastCheckedLabel")}:{" "}
						{formatTimestamp(service.lastChecked, neverSeenLabel)}
					</Typography>
				</Box>
			</CardContent>
		</Card>
	);
}
