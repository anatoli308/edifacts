// ----------------------------------------------------------------------

export default function ListItem(theme) {
  return {
    MuiListItem: {
      styleOverrides: {
        root: {
          //padding: 0,
          /*'&:hover': {
              backgroundColor: theme.palette.grey[500_8], // Change the background color on hover
          }*/
        },
      },
    },
    MuiListItemSecondaryAction: {
      styleOverrides: {
        root: {
          right: "4px",
          top: 0,
          transform: 'translateY(0%)',
          padding: theme.spacing(0.5),
        },
      },
    }
  };
}
