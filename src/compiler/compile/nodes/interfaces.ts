import Tag from './shared/Tag';
import Animation from './Animation';
import Attribute from './Attribute';
import Binding from './Binding';
import Body from './Body';
import Class from './Class';
import Comment from './Comment';
import Element from './Element';
import ElseBlock from './ElseBlock';
import EventHandler from './EventHandler';
import Fragment from './Fragment';
import Head from './Head';
import IfBlock from './IfBlock';
import InlineComponent from './InlineComponent';
import MustacheTag from './MustacheTag';
import Options from './Options';
import Text from './Text';
import Transition from './Transition';
import Window from './Window';

// note: to write less types each of types in union below should have type defined as literal
// https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions
export type INode = Animation
| Attribute
| Binding
| Body
| Class
| Comment
| Element
| ElseBlock
| EventHandler
| Fragment
| Head
| IfBlock
| InlineComponent
| MustacheTag
| Options
| Tag
| Text
| Transition
| Window;
