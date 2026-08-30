/*------------------------------------------------------    
【程序改错】
--------------------------------------------------------

题目：从键盘输入一个字符串，实现将输入的字符串写入文件out中，
并反序输出，如输入windows 输出swodniw。     
--------------------------------------------------------
注意：不可以增加或删除程序行，也不可以更改程序的结构。
------------------------------------------------------*/
#include "stdio.h"
#include "stdlib.h"
/**********FOUND**********/
#include "string.h"

void invert(char *s)
{ int i,j,k;
  char t;
/**********FOUND**********/
  k=strlen(s);
  for(i=0,j=k-1;i<k/2;i++,j--)
  {  t=*(s+i);  *(s+i)=*(s+j);  *(s+j)=t; }
}

main()
{ FILE *fp;
  char str[200],*p,i,j;
/**********FOUND**********/
  if((fp=fopen("out","w"))==NULL) 
     { printf("cannot open the file\n");
       exit(0);                       
     }
   printf("input str:\n");
   gets(str);
   printf("\n%s",str);
   fprintf(fp,"%s",str);
   invert(str);
   printf("\n%s",str);
   fprintf(fp,"\n%s",str);
/**********FOUND**********/
  fclose(fp);
}
