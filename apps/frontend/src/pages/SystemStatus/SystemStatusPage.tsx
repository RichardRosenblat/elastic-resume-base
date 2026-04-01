/**
 * @file SystemStatusPage.tsx — System health status page.
 *
 * Fetches downstream service health from the Gateway API `GET /health/downstream`
 * endpoint and renders a status card for each service. Handles loading,
 * success, and error states according to the acceptance criteria.
 */
import { useEffect, useState } from "react";
import { Box, Typography, Card, CardContent, Grid, Chip } from "@mui/material";
import { CheckCircle as CheckCircleIcon, Cancel as CancelIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { getDownstreamHealth } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import type { DownstreamHealthData } from "../../types";

/** Maps the Gateway API service key to its canonical technical service name. */
const SERVICE_TECHNICAL_NAMES: Record<string, string> = {
	usersApi: "users-api",
	downloader: "downloader",
	searchBase: "search-base",
	fileGenerator: "file-generator",
	documentReader: "document-reader",
};

/**
 * Displays the operational status of a single downstream service with
 * a user-friendly name, description, impact notice, and technical identifier.
 */
function ServiceStatusCard({ name, status }: { name: string; status: "ok" | "degraded" }) {
	const { t } = useTranslation();
	const isOk = status === "ok";
	const icon = isOk ? <CheckCircleIcon fontSize="small" /> : <CancelIcon fontSize="small" />;
	const technicalName = SERVICE_TECHNICAL_NAMES[name] ?? name;

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
						icon={icon}
						label={isOk ? t("systemStatus.statusOk") : t("systemStatus.statusDegraded")}
						color={isOk ? "success" : "error"}
						size="small"
						sx={{ flexShrink: 0 }}
					/>
				</Box>

				{/* Service description */}
				<Typography variant="body2" color="text.secondary">
					{t(`systemStatus.services.${name}.description`)}
				</Typography>

				{/* Impact notice — always shown so users understand the service's importance */}
				<Typography
					variant="body2"
					color={isOk ? "text.secondary" : "error.main"}
					display={isOk ? "none" : "block"}
					sx={{ mt: 0.5, fontStyle: "italic" }}
				>
					{t(`systemStatus.services.${name}.impact`)}
				</Typography>
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
						.sort(([, s1], [, s2]) => -s1.status.localeCompare(s2.status))
						.map(([name, service]) => (
							<Grid key={name} size={{ xs: 12, sm: 6, md: 4 }}>
								<ServiceStatusCard name={name} status={service.status} />
							</Grid>
						))}
				</Grid>
			)}
		</Box>
	);
}
