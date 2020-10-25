import Tag from './shared/Tag';
import Attribute from './Attribute';
import Binding from './Binding';
import Class from './Class';
import Element from './Element';
import ElseBlock from './ElseBlock';
import EventHandler from './EventHandler';
import Fragment from './Fragment';
import IfBlock from './IfBlock';
import InlineComponent from './InlineComponent';
import MustacheTag from './MustacheTag';
import Text from './Text';
import Window from './Window';

// note: to write less types each of types in union below should have type defined as literal
// https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions
export type INode = Attribute
| Binding
| Class
| Element
| ElseBlock
| EventHandler
| Fragment
| IfBlock
| InlineComponent
| MustacheTag
| Tag
| Text
| Window;
