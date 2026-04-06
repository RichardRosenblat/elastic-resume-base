/**
 * @file SystemStatusPage.tsx — System health status page.
 *
 * Fetches downstream service health from the Gateway API `GET /health/downstream`
 * endpoint and renders a status card for each service. Handles loading,
 * success, and error states according to the acceptance criteria.
 */
import { useEffect, useState } from "react";
import { Box, Typography, Card, CardContent, Grid } from "@mui/material";
import { Cancel as CancelIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { getDownstreamHealth } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { ServiceStatusCardTemplate, deriveServiceState } from "../../components/templates";
import type { DownstreamHealthData } from "../../types";

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
							return order[deriveServiceState(s1)] - order[deriveServiceState(s2)];
						})
						.map(([name, service]) => (
							<Grid key={name} size={{ xs: 12, sm: 6, md: 4 }}>
								<ServiceStatusCardTemplate name={name} service={service} />
							</Grid>
						))}
				</Grid>
			)}
		</Box>
	);
}

