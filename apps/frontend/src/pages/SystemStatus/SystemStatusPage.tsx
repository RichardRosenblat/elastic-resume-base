/**
 * @file SystemStatusPage.tsx — System health status page.
 *
 * Fetches downstream service health from the Gateway API `GET /health/downstream`
 * endpoint and renders a status card for each service. Handles loading,
 * success, and error states according to the acceptance criteria.
 */
import { useEffect, useState } from "react";
import { Box, Typography, Card, CardContent, Grid, Chip } from "@mui/material";
import {
	CheckCircle as CheckCircleIcon,
	Cancel as CancelIcon,
	AccessTime as AccessTimeIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { getDownstreamHealth } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import type { DownstreamHealthData, DownstreamServiceStatus } from "../../types";

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
function deriveState(service: DownstreamServiceStatus): "ready" | "idle" | "unavailable" {
	if (!service.live) return "unavailable";
	return service.temperature === "warm" ? "ready" : "idle";
}

/**
 * Formats an ISO timestamp for display. Returns the i18n "neverSeen" key when
 * the value is null or undefined.
 */
function formatTimestamp(iso: string | null | undefined, neverSeenLabel: string): string {
	if (!iso) return neverSeenLabel;
	return new Date(iso).toLocaleString();
}

/**
 * Displays the operational status of a single downstream service with
 * a user-friendly name, description, impact notice, and technical identifier.
 */
function ServiceStatusCard({ name, service }: { name: string; service: DownstreamServiceStatus }) {
	const { t } = useTranslation();
	const state = deriveState(service);
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

				{/* Impact notice — shown only when the service is not ready */}
				{state !== "ready" && (
					<Typography
						variant="body2"
						color={state === "unavailable" ? "error.main" : "warning.main"}
						sx={{ mt: 0.5, fontStyle: "italic" }}
					>
						{t(`systemStatus.services.${name}.impact`)}
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

/**
 * Page that fetches and renders the health status of all downstream services
 * registered in the Gateway API. Accessible via `/system-status`.
 */
export default function SystemStatusPage() {
	const { t } = useTranslation();
	const [data, setData] = useState<DownstreamHealthData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;

		const fetchHealth = async () => {
			setLoading(true);
			setError(false);
			try {
				const result = await getDownstreamHealth();
				if (!cancelled) {
					setData(result);
				}
			} catch {
				if (!cancelled) {
					setError(true);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void fetchHealth();

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<Box>
			<Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>
				{t("systemStatus.title")}
			</Typography>

			{loading && <LoadingSpinner message={t("systemStatus.loading")} />}

			{!loading && error && (
				<Card>
					<CardContent>
						<Box display="flex" alignItems="center" gap={1}>
							<CancelIcon color="error" />
							<Typography variant="body1" color="error">
								{t("systemStatus.unavailable")}
							</Typography>
						</Box>
					</CardContent>
				</Card>
			)}

			{!loading && !error && data && (
				<Grid container spacing={2}>
					{Object.entries(data.downstream)
						.sort(([, s1], [, s2]) => {
							// Sort order: ready first, then idle, then unavailable
							const order = { ready: 0, idle: 1, unavailable: 2 };
							return order[deriveState(s1)] - order[deriveState(s2)];
						})
						.map(([name, service]) => (
							<Grid key={name} size={{ xs: 12, sm: 6, md: 4 }}>
								<ServiceStatusCard name={name} service={service} />
							</Grid>
						))}
				</Grid>
			)}
		</Box>
	);
}
