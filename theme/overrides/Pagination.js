// ----------------------------------------------------------------------

export default function Pagination(theme) {
    return {
      MuiPagination: {
        styleOverrides: {
            ul:{
                justifyContent: 'space-between',
            },
          root: {
            //padding: 0,
            /*'&:hover': {
                backgroundColor: theme.palette.grey[500_8], // Change the background color on hover
            }*/
          },
        },
      },
    };
  }
  