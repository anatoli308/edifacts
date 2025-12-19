import Card from './Card';
import Paper from './Paper';
import Input from './Input';
import Button from './Button';
import Tooltip from './Tooltip';
import Backdrop from './Backdrop';
import Typography from './Typography';
import CssBaseline from './CssBaseline';
import Autocomplete from './Autocomplete';
import Lists from './Lists';
import Box from './Box';
import ListItem from './ListItem';
import Pagination from './Pagination';
import Timeline from './Timeline';

// ----------------------------------------------------------------------

export default function ComponentsOverrides(theme) {
  return Object.assign(
    Card(theme),
    Input(theme),
    Paper(theme),
    Button(theme),
    Tooltip(theme),
    Backdrop(theme),
    Typography(theme),
    CssBaseline(theme),
    Autocomplete(theme),
    Lists(theme),
    Box(theme),
    ListItem(theme),
    Pagination(theme),
    Timeline(theme)
  );
}
