// ----------------------------------------------------------------------
export default function Timeline(theme) {
    return {
        MuiTimeline: {
            styleOverrides: {
                root: {
                    padding: '7px', // same as paddingLeft in LTR
                    paddingBottom: 0,
                    backgroundColor: 'transparent', // optional, adjust as needed
                },
            },
        },
    };
}
