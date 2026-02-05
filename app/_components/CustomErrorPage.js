"use client";
import Link from "next/link";
import { Link as MuiLink } from "@mui/material";
import { Box, Typography } from "@mui/material";

export default function CustomErrorPage({
    statusCode = 404,
    title = "Page not found",
    description = "The page you are looking for does not exist or was moved.",
}) {
    return (
        <Box sx={{ maxWidth: 560 }}>
            <Typography variant="h1" sx={{ fontWeight: 700, mb: 1 }}>
                {statusCode}
            </Typography>
            <Typography variant="h4" sx={{ mb: 2 }}>
                {title}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {description}
            </Typography>
            <MuiLink
                as={Link}
                href="/"
                underline="hover"
                variant="body1"
            >
                Go back home
            </MuiLink>
        </Box>
    );
}