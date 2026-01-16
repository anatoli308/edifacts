// ----------------------------------------------------------------------

export default function Card(theme) {
  return {
    MuiCard: {
      styleOverrides: {
        root: {
          //boxShadow: theme.shadows[2],
          borderRadius: Number(theme.shape.borderRadius) * 2,
          position: 'relative',
          zIndex: 0, // Fix Safari overflow: hidden with border radius
        },
      },
    },
    MuiCardHeader: {
      defaultProps: {
        titleTypographyProps: { variant: 'h6' },
        subheaderTypographyProps: { variant: 'body2' },
      },
      styleOverrides: {
        root: {
          padding: theme.spacing(1, 2, 0),
        },
        avatar:{
          marginRight:"8px"
        }
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          //padding: theme.spacing(0),
          /*"&&:last-child": {
            paddingBottom: 0
          }*/
        },
      },
    },
  };
}
